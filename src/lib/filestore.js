// ── File Storage — via Cloudflare Worker proxy ────────────────
// PAT never in the browser. All GitHub calls go through the worker.

const WORKER = import.meta.env.VITE_WORKER_URL
const API    = `${WORKER}/api/contents`
const RAW    = `${WORKER}/api/raw`

function safePart(s) {
  return (s || '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'file'
}

function extensionFromName(name, fallback = '') {
  const parts = String(name || '').split('.')
  if (parts.length < 2) return fallback
  return parts.pop().toLowerCase().replace(/[^a-z0-9]/g, '') || fallback
}

// ── Internal helpers ──────────────────────────────────────────

async function getExistingSha(filePath) {
  try {
    const res = await fetch(`${API}/${filePath}`)
    if (!res.ok) return null
    const data = await res.json()
    return data.sha || null
  } catch { return null }
}

async function uploadBinaryFile(file, filePath, commitMessage) {
  const base64 = await fileToBase64(file)
  const sha    = await getExistingSha(filePath)

  const res = await fetch(`${API}/${filePath}`, {
    method:  'PUT',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      message: commitMessage,
      content: base64,
      ...(sha ? { sha } : {}),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Upload failed (${res.status})`)
  }

  const data = await res.json()
  return {
    path:        filePath,
    fileName:    filePath.split('/').pop() || file.name || 'file',
    downloadUrl: data.content?.download_url || '',
  }
}

async function fetchStoredBlob(storedPath) {
  // /api/raw/ returns the raw file bytes via the worker
  const res = await fetch(`${RAW}/${storedPath}`)

  if (res.status === 404) throw new Error(`File not found: ${storedPath}`)
  if (!res.ok)            throw new Error(`Download error ${res.status} for ${storedPath}`)

  const blob     = await res.blob()
  const fileName = storedPath.split('/').pop() || 'file'
  return { blob, fileName, contentType: blob.type || '' }
}

// ── Public API ────────────────────────────────────────────────

export async function getStoredFileObjectUrl(storedPath) {
  const { blob, fileName, contentType } = await fetchStoredBlob(storedPath)
  return { objectUrl: URL.createObjectURL(blob), fileName, contentType }
}

export async function openStoredFileInBrowser(storedPath) {
  if (!storedPath) throw new Error('No file path found.')
  const popup = window.open('', '_blank', 'noopener,noreferrer')
  try {
    const { blob, fileName } = await fetchStoredBlob(storedPath)
    const url = URL.createObjectURL(blob)
    if (popup) { popup.document.title = fileName; popup.location.href = url }
    else window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    if (popup && !popup.closed) popup.close()
    throw err
  }
}

// ── Proof PDFs ────────────────────────────────────────────────

export function buildFileName(tabId, facultyName, formValues) {
  const tabNum   = tabId.replace('tab', '').padStart(2, '0')
  const parts    = (facultyName || '').trim().split(/\s+/)
  const lastName = safePart(parts[parts.length - 1] || 'Faculty')

  const keyFields = [
    'title', 'course_name', 'patent_number', 'student_name',
    'event_name', 'training_name', 'project_title',
    'organisation_name', 'industry_name', 'company_name',
    'society_name', 'inventor_name', 'journal_or_conf_name',
  ]

  let keyVal = 'proof'
  for (const k of keyFields) {
    if (formValues?.[k]) { keyVal = safePart(String(formValues[k]).slice(0, 35)); break }
  }

  return `${tabNum}_${lastName}_${keyVal}_${new Date().toISOString().slice(0, 10)}.pdf`
}

export async function uploadProof(file, tabId, userId, facultyName, formValues) {
  if (!file.type?.includes('pdf') && !file.name?.toLowerCase().endsWith('.pdf'))
    throw new Error('Only PDF files are accepted as proof.')
  if (file.size > 10 * 1024 * 1024)
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`)

  const fileName = buildFileName(tabId, facultyName, formValues)
  const filePath = `proofs/${tabId}/${userId}/${fileName}`
  return uploadBinaryFile(file, filePath, `proof: ${tabId}/${userId}/${fileName}`)
}

export async function downloadProof(storedPath) {
  const { blob, fileName } = await fetchStoredBlob(storedPath)
  return { blob: new Blob([blob], { type: 'application/pdf' }), fileName }
}

export async function listProofsForTab(tabId) {
  const res = await fetch(`${API}/proofs/${tabId}`)
  if (!res.ok) return []
  const userFolders = await res.json()
  if (!Array.isArray(userFolders)) return []

  const all = []
  await Promise.all(userFolders.map(async folder => {
    if (folder.type !== 'dir') return
    const r = await fetch(`${API}/proofs/${tabId}/${folder.name}`)
    if (!r.ok) return
    const files = await r.json()
    if (!Array.isArray(files)) return
    files.filter(f => f.name.endsWith('.pdf')).forEach(f => {
      all.push({ userId: folder.name, fileName: f.name, path: f.path, sha: f.sha })
    })
  }))
  return all
}

export const proofFileNameFromPath   = p => p?.split('/')?.pop() || 'proof.pdf'
export const openProofInBrowser      = storedPath => openStoredFileInBrowser(storedPath)

// ── Profile pictures ──────────────────────────────────────────

export function profilePictureFileNameFromPath(storedPath) {
  return storedPath?.split('/')?.pop() || 'profile-picture'
}

export async function uploadProfilePicture(file, userId, facultyName) {
  const ext = extensionFromName(file.name, 'jpg')
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type) && !['jpg','jpeg','png','webp'].includes(ext))
    throw new Error('Only JPG, PNG, or WEBP images are accepted.')
  if (file.size > 5 * 1024 * 1024)
    throw new Error(`Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`)

  const parts    = (facultyName || '').trim().split(/\s+/)
  const lastName = safePart(parts[parts.length - 1] || 'Faculty')
  const fileName = `${lastName}_profile.${ext || 'jpg'}`
  const filePath = `profile-pictures/${userId}/${fileName}`
  return uploadBinaryFile(file, filePath, `profile-picture: ${userId}/${fileName}`)
}

// ── Helper ────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
