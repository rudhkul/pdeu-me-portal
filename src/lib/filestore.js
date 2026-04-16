// ── GitHub-backed binary file storage ─────────────────────────
// Stores proof PDFs and profile pictures directly in the private
// data repository through the GitHub contents API.

const OWNER = import.meta.env.VITE_DATA_REPO_OWNER
const REPO  = import.meta.env.VITE_DATA_REPO_NAME
const PAT   = import.meta.env.VITE_GITHUB_PAT
const API   = `https://api.github.com/repos/${OWNER}/${REPO}`

const HEADERS = {
  Authorization: `Bearer ${PAT}`,
  Accept: 'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
}

function safePart(s) {
  return (s || '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'file'
}

function extensionFromName(name, fallback = '') {
  const parts = String(name || '').split('.')
  if (parts.length < 2) return fallback
  const ext = parts.pop().toLowerCase()
  return ext.replace(/[^a-z0-9]/g, '') || fallback
}

async function getExistingSha(filePath) {
  try {
    const check = await fetch(`${API}/contents/${filePath}`, { headers: HEADERS })
    if (!check.ok) return null
    const existing = await check.json()
    return existing.sha || null
  } catch {
    return null
  }
}

async function uploadBinaryFile(file, filePath, commitMessage) {
  const base64 = await fileToBase64(file)
  const sha = await getExistingSha(filePath)

  const res = await fetch(`${API}/contents/${filePath}`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({
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
    path: filePath,
    fileName: filePath.split('/').pop() || file.name || 'file',
    downloadUrl: data.content?.download_url || '',
    rawUrl: `${API}/contents/${filePath}`,
  }
}

async function fetchStoredBlob(storedPath) {
  const res = await fetch(`${API}/contents/${storedPath}`, {
    headers: {
      Authorization: `Bearer ${PAT}`,
      Accept: 'application/vnd.github.raw',
    },
  })

  if (res.status === 404) throw new Error(`File not found: ${storedPath}`)
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${storedPath}`)

  const blob = await res.blob()
  const fileName = storedPath.split('/').pop() || 'file'
  return { blob, fileName, contentType: blob.type || '' }
}

export async function getStoredFileObjectUrl(storedPath) {
  const { blob, fileName, contentType } = await fetchStoredBlob(storedPath)
  return {
    objectUrl: URL.createObjectURL(blob),
    fileName,
    contentType,
  }
}

export async function openStoredFileInBrowser(storedPath) {
  if (!storedPath) throw new Error('No file path found.')

  const popup = window.open('', '_blank', 'noopener,noreferrer')

  try {
    const { blob, fileName } = await fetchStoredBlob(storedPath)
    const url = URL.createObjectURL(blob)

    if (popup) {
      popup.document.title = fileName
      popup.location.href = url
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }

    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (err) {
    if (popup && !popup.closed) popup.close()
    throw err
  }
}

// ── Proof PDF helpers ─────────────────────────────────────────
export function buildFileName(tabId, facultyName, formValues) {
  const tabNum = tabId.replace('tab', '').padStart(2, '0')

  const parts = (facultyName || '').trim().split(/\s+/)
  const lastName = safePart(parts[parts.length - 1] || 'Faculty')

  const keyFields = [
    'title', 'course_name', 'patent_number', 'student_name',
    'event_name', 'training_name', 'project_title',
    'organisation_name', 'industry_name', 'company_name',
    'society_name', 'inventor_name', 'journal_or_conf_name',
  ]

  let keyVal = 'proof'
  for (const k of keyFields) {
    if (formValues?.[k]) {
      keyVal = safePart(String(formValues[k]).slice(0, 35))
      break
    }
  }

  const date = new Date().toISOString().slice(0, 10)
  return `${tabNum}_${lastName}_${keyVal}_${date}.pdf`
}

export async function uploadProof(file, tabId, userId, facultyName, formValues) {
  if (!file.type?.includes('pdf') && !file.name?.toLowerCase().endsWith('.pdf')) {
    throw new Error('Only PDF files are accepted as proof.')
  }

  const MAX_MB = 10
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_MB} MB.`)
  }

  const fileName = buildFileName(tabId, facultyName, formValues)
  const filePath = `proofs/${tabId}/${userId}/${fileName}`

  return uploadBinaryFile(file, filePath, `proof: ${tabId}/${userId}/${fileName}`)
}

export async function downloadProof(storedPath) {
  const { blob, fileName } = await fetchStoredBlob(storedPath)
  return { blob: new Blob([blob], { type: 'application/pdf' }), fileName }
}

export async function listProofsForTab(tabId) {
  const res = await fetch(`${API}/contents/proofs/${tabId}`, { headers: HEADERS })
  if (res.status === 404) return []
  if (!res.ok) return []
  const userFolders = await res.json()
  if (!Array.isArray(userFolders)) return []

  const all = []
  await Promise.all(userFolders.map(async folder => {
    if (folder.type !== 'dir') return
    const filesRes = await fetch(`${API}/contents/proofs/${tabId}/${folder.name}`, { headers: HEADERS })
    if (!filesRes.ok) return
    const files = await filesRes.json()
    if (!Array.isArray(files)) return
    files.filter(f => f.name.endsWith('.pdf')).forEach(f => {
      all.push({ userId: folder.name, fileName: f.name, path: f.path, sha: f.sha })
    })
  }))
  return all
}

export function proofFileNameFromPath(storedPath) {
  return storedPath?.split('/')?.pop() || 'proof.pdf'
}

export async function openProofInBrowser(storedPath) {
  return openStoredFileInBrowser(storedPath)
}

// ── Profile picture helpers ───────────────────────────────────
export function profilePictureFileNameFromPath(storedPath) {
  return storedPath?.split('/')?.pop() || 'profile-picture'
}

export async function uploadProfilePicture(file, userId, facultyName) {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  const ext = extensionFromName(file.name, 'jpg')

  if (!allowedTypes.includes(file.type) && !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    throw new Error('Only JPG, PNG, or WEBP images are accepted.')
  }

  const MAX_MB = 5
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`Image too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_MB} MB.`)
  }

  const parts = (facultyName || '').trim().split(/\s+/)
  const lastName = safePart(parts[parts.length - 1] || 'Faculty')
  const fileName = `${lastName}_profile.${ext || 'jpg'}`
  const filePath = `profile-pictures/${userId}/${fileName}`

  return uploadBinaryFile(file, filePath, `profile-picture: ${userId}/${fileName}`)
}

// ── Helper: File → base64 ─────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const b64 = reader.result.split(',')[1]
      resolve(b64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
