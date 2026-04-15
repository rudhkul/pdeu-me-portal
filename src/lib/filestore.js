// ── PDF Proof Storage via GitHub API ──────────────────────────
// Stores proof PDFs directly in the private pdeu-me-data repository.
// Uses the same PAT that's already in the build — zero new services.
//
// Storage structure:
//   proofs/
//     tab5/
//       usr_abc123/
//         05_Kant_EnergyJournal_2025-04-15.pdf
//         05_Kant_PatentReview_2025-04-16.pdf
//     tab6/
//       usr_def456/
//         06_Vora_SERB-Project_2025-04-15.pdf

const OWNER = import.meta.env.VITE_DATA_REPO_OWNER
const REPO  = import.meta.env.VITE_DATA_REPO_NAME
const PAT   = import.meta.env.VITE_GITHUB_PAT
const API   = `https://api.github.com/repos/${OWNER}/${REPO}`

const HEADERS = {
  Authorization:  `Bearer ${PAT}`,
  Accept:         'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
}

// ── Auto-generate filename from context ───────────────────────
export function buildFileName(tabId, facultyName, formValues) {
  const tabNum = tabId.replace('tab', '').padStart(2, '0')

  // Last name only
  const parts    = (facultyName || '').trim().split(/\s+/)
  const lastName = safePart(parts[parts.length - 1] || 'Faculty')

  // Key identifier from form
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

function safePart(s) {
  return (s || '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40) || 'file'
}

// ── Upload a PDF to GitHub ────────────────────────────────────
// Returns: { path, downloadUrl, rawUrl }
export async function uploadProof(file, tabId, userId, facultyName, formValues) {
  if (!file.type?.includes('pdf') && !file.name?.toLowerCase().endsWith('.pdf')) {
    throw new Error('Only PDF files are accepted as proof.')
  }

  const MAX_MB = 10
  if (file.size > MAX_MB * 1024 * 1024) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_MB} MB.`)
  }

  const fileName   = buildFileName(tabId, facultyName, formValues)
  const filePath   = `proofs/${tabId}/${userId}/${fileName}`

  // Read file as base64
  const base64 = await fileToBase64(file)

  // Check if file already exists (need sha to update)
  let sha = null
  try {
    const check = await fetch(`${API}/contents/${filePath}`, { headers: HEADERS })
    if (check.ok) {
      const existing = await check.json()
      sha = existing.sha
    }
  } catch { /* new file */ }

  // Upload
  const body = {
    message: `proof: ${tabId}/${userId}/${fileName}`,
    content: base64,
    ...(sha ? { sha } : {}),
  }

  const res = await fetch(`${API}/contents/${filePath}`, {
    method:  'PUT',
    headers: HEADERS,
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Upload failed (${res.status})`)
  }

  const data = await res.json()
  return {
    path:        filePath,
    fileName,
    downloadUrl: data.content?.download_url || '',
    // Stable raw URL (works with PAT auth)
    rawUrl:      `${API}/contents/${filePath}`,
  }
}

// ── Download a proof PDF by its stored GitHub path ────────────
// storedPath = "proofs/tab5/usr_abc/05_Kant_file.pdf"
// Returns: { blob, fileName }
// Note: ProofDownloader has its own inline fetch — this export is
// kept for any other callers that may need it.
export async function downloadProof(storedPath) {
  const res = await fetch(`${API}/contents/${storedPath}`, { headers: HEADERS })
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${storedPath}`)
  const meta = await res.json()

  let blob
  if (meta.content && !meta.truncated) {
    const binary = atob(meta.content.replace(/
/g, ''))
    const bytes  = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    blob = new Blob([bytes], { type: 'application/pdf' })
  } else if (meta.download_url) {
    const dlRes = await fetch(meta.download_url, { headers: HEADERS })
    if (!dlRes.ok) throw new Error(`Download failed (${dlRes.status}) for ${meta.name}`)
    blob = await dlRes.blob()
  } else {
    throw new Error(`No content available for ${storedPath}`)
  }

  return { blob, fileName: meta.name || 'proof.pdf' }
}

// ── List all proofs for a tab (admin use) ─────────────────────
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

// ── Helper: File → base64 ─────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => {
      // Remove data URL prefix (e.g. "data:application/pdf;base64,")
      const b64 = reader.result.split(',')[1]
      resolve(b64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
