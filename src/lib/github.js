// ── GitHub API wrapper ────────────────────────────────────────────────
// All data lives as JSON files in a private GitHub repository.

const OWNER   = import.meta.env.VITE_DATA_REPO_OWNER
const REPO    = import.meta.env.VITE_DATA_REPO_NAME
const PAT     = import.meta.env.VITE_GITHUB_PAT
const API     = `https://api.github.com/repos/${OWNER}/${REPO}/contents`

const HEADERS = {
  Authorization:  `Bearer ${PAT}`,
  Accept:         'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
}

// ── Friendly error handler ────────────────────────────────────
function handleGitHubError(status, path) {
  if (status === 401) throw new Error('GitHub token has expired or is invalid. Please contact the administrator to renew the access token.')
  if (status === 403) throw new Error('Access denied. The GitHub token may not have permission to access this repository.')
  if (status === 404) return null   // caller handles missing files
  if (status === 409) throw new Error('Data conflict — someone else may have saved at the same time. Please refresh and try again.')
  if (status === 422) throw new Error('Invalid data format. Please contact support.')
  if (status >= 500)  throw new Error('GitHub is experiencing issues. Please try again in a few minutes.')
  throw new Error(`GitHub error (${status}) for ${path}`)
}

// ── Read a JSON file ──────────────────────────────────────────
export async function readJSON(path) {
  const res = await fetch(`${API}/${path}`, { headers: HEADERS })
  if (res.status === 404) return { data: null, sha: null }
  if (!res.ok) handleGitHubError(res.status, path)

  const meta    = await res.json()
  const decoded = decodeURIComponent(escape(atob(meta.content.replace(/\n/g, ''))))
  return { data: JSON.parse(decoded), sha: meta.sha }
}

// ── Write (create or update) a JSON file ─────────────────────
export async function writeJSON(path, data, sha = null) {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))))
  const body    = {
    message: `portal: update ${path}`,
    content,
    ...(sha ? { sha } : {}),
  }
  const res = await fetch(`${API}/${path}`, {
    method:  'PUT',
    headers: HEADERS,
    body:    JSON.stringify(body),
  })
  if (!res.ok) handleGitHubError(res.status, path)
  return res.json()
}

// ── List all files in a directory ────────────────────────────
export async function listDir(path) {
  const res = await fetch(`${API}/${path}`, { headers: HEADERS })
  if (res.status === 404) return []
  if (!res.ok) handleGitHubError(res.status, path)
  const items = await res.json()
  return Array.isArray(items) ? items : []
}

// ── Faculty record CRUD ───────────────────────────────────────

export async function getFacultyRecords(tabId, userId) {
  const { data } = await readJSON(`records/${tabId}/${userId}.json`)
  return data || []
}

export async function getAllRecordsForTab(tabId) {
  const files    = await listDir(`records/${tabId}`)
  const jsonFiles = files.filter(f => f.name.endsWith('.json'))
  if (!jsonFiles.length) return []
  const chunks = await Promise.all(
    jsonFiles.map(f => readJSON(`records/${tabId}/${f.name}`).then(r => r.data || []))
  )
  return chunks.flat()
}

export async function saveFacultyRecords(tabId, userId, records) {
  const path    = `records/${tabId}/${userId}.json`
  const { sha } = await readJSON(path)
  await writeJSON(path, records, sha)
}

export async function addRecord(tabId, userId, newRecord) {
  const path          = `records/${tabId}/${userId}.json`
  const { data, sha } = await readJSON(path)
  const records       = data || []
  const now           = new Date().toISOString()
  const updated       = [...records, { ...newRecord, id: crypto.randomUUID(), createdAt: now, updatedAt: now }]
  await writeJSON(path, updated, sha)
  return updated
}

export async function updateRecord(tabId, userId, recordId, changes) {
  const path          = `records/${tabId}/${userId}.json`
  const { data, sha } = await readJSON(path)
  const records       = (data || []).map(r =>
    r.id === recordId ? { ...r, ...changes, updatedAt: new Date().toISOString() } : r
  )
  await writeJSON(path, records, sha)
  return records
}

export async function deleteRecord(tabId, userId, recordId) {
  const path          = `records/${tabId}/${userId}.json`
  const { data, sha } = await readJSON(path)
  const records       = (data || []).filter(r => r.id !== recordId)
  await writeJSON(path, records, sha)
  return records
}

// Admin: update any faculty's record (by admin)
export async function adminUpdateRecord(tabId, userId, recordId, changes) {
  return updateRecord(tabId, userId, recordId, changes)
}

export async function adminDeleteRecord(tabId, userId, recordId) {
  return deleteRecord(tabId, userId, recordId)
}

export async function getAllFaculties() {
  const { data } = await readJSON('users.json')
  return (data || []).filter(u => u.role === 'faculty').map(u => ({
    id: u.id, fullName: u.fullName, email: u.email,
  }))
}

export async function getUsers() {
  const { data } = await readJSON('users.json')
  return (data || []).map(({ passwordHash, salt, ...rest }) => rest)
}
