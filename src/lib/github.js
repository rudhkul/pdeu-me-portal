// ── GitHub API wrapper ────────────────────────────────────────────────
// All faculty data is stored as JSON files in a private GitHub repository.
// Structure:
//   users.json                         ← user list (hashed passwords + roles)
//   records/tab1/<userId>.json         ← array of records for that user
//   records/tab2/<userId>.json
//   ...

const OWNER   = import.meta.env.VITE_DATA_REPO_OWNER
const REPO    = import.meta.env.VITE_DATA_REPO_NAME
const PAT     = import.meta.env.VITE_GITHUB_PAT
const API     = `https://api.github.com/repos/${OWNER}/${REPO}/contents`

const HEADERS = {
  Authorization: `Bearer ${PAT}`,
  Accept:        'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
}

// ── Read a JSON file from the data repo ──────────────────────────────
// Returns { data, sha } — sha is needed for subsequent writes
export async function readJSON(path) {
  const res = await fetch(`${API}/${path}`, { headers: HEADERS })
  if (res.status === 404) return { data: null, sha: null }
  if (!res.ok) throw new Error(`GitHub read failed (${res.status}) for ${path}`)

  const meta    = await res.json()
  const decoded = decodeURIComponent(escape(atob(meta.content.replace(/\n/g, ''))))
  return { data: JSON.parse(decoded), sha: meta.sha }
}

// ── Write (create or update) a JSON file ─────────────────────────────
// sha must be provided when updating an existing file
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

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `GitHub write failed (${res.status}) for ${path}`)
  }
  return res.json()
}

// ── List all files inside a directory ────────────────────────────────
export async function listDir(path) {
  const res = await fetch(`${API}/${path}`, { headers: HEADERS })
  if (res.status === 404) return []
  if (!res.ok) return []
  const items = await res.json()
  return Array.isArray(items) ? items : []
}

// ── CRUD helpers for faculty records ─────────────────────────────────

/**
 * Get all records for a specific faculty in a specific tab.
 */
export async function getFacultyRecords(tabId, userId) {
  const { data } = await readJSON(`records/${tabId}/${userId}.json`)
  return data || []
}

/**
 * Get all records for all faculties in a tab (admin use).
 * Fetches in parallel.
 */
export async function getAllRecordsForTab(tabId) {
  const files = await listDir(`records/${tabId}`)
  const jsonFiles = files.filter(f => f.name.endsWith('.json'))
  if (jsonFiles.length === 0) return []

  const chunks = await Promise.all(
    jsonFiles.map(f => readJSON(`records/${tabId}/${f.name}`).then(r => r.data || []))
  )
  return chunks.flat()
}

/**
 * Save (overwrite) the entire records array for a faculty in a tab.
 */
export async function saveFacultyRecords(tabId, userId, records) {
  const path      = `records/${tabId}/${userId}.json`
  const { sha }   = await readJSON(path)
  await writeJSON(path, records, sha)
}

/**
 * Append a new record for a faculty.
 * Returns updated records array.
 */
export async function addRecord(tabId, userId, newRecord) {
  const path       = `records/${tabId}/${userId}.json`
  const { data, sha } = await readJSON(path)
  const records    = data || []
  const updated    = [...records, { ...newRecord, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]
  await writeJSON(path, updated, sha)
  return updated
}

/**
 * Update an existing record by id.
 */
export async function updateRecord(tabId, userId, recordId, changes) {
  const path       = `records/${tabId}/${userId}.json`
  const { data, sha } = await readJSON(path)
  const records    = (data || []).map(r =>
    r.id === recordId ? { ...r, ...changes, updatedAt: new Date().toISOString() } : r
  )
  await writeJSON(path, records, sha)
  return records
}

/**
 * Delete a record by id.
 */
export async function deleteRecord(tabId, userId, recordId) {
  const path       = `records/${tabId}/${userId}.json`
  const { data, sha } = await readJSON(path)
  const records    = (data || []).filter(r => r.id !== recordId)
  await writeJSON(path, records, sha)
  return records
}

/**
 * Get all faculties (for admin dropdown).
 * Reads users.json and returns faculty-role users.
 */
export async function getAllFaculties() {
  const { data } = await readJSON('users.json')
  return (data || []).filter(u => u.role === 'faculty').map(u => ({
    id: u.id, fullName: u.fullName, email: u.email,
  }))
}

/**
 * Get all users (admins reading users list).
 * Strips password hashes before returning.
 */
export async function getUsers() {
  const { data } = await readJSON('users.json')
  return (data || []).map(({ passwordHash, salt, ...rest }) => rest)
}
