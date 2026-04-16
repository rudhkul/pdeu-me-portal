const OWNER   = import.meta.env.VITE_DATA_REPO_OWNER
const REPO    = import.meta.env.VITE_DATA_REPO_NAME
const PAT     = import.meta.env.VITE_GITHUB_PAT
const API     = `https://api.github.com/repos/${OWNER}/${REPO}/contents`
const HEADERS = {
  Authorization:  `Bearer ${PAT}`,
  Accept:         'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
}

function handleError(status, path) {
  if (status === 401) throw new Error('GitHub token has expired. Contact the administrator.')
  if (status === 403) throw new Error('Access denied. GitHub token may lack permission.')
  if (status === 409) throw new Error('Data conflict — someone else saved at the same time. Refresh and try again.')
  if (status >= 500)  throw new Error('GitHub is down. Please try again in a few minutes.')
  if (status !== 404) throw new Error(`GitHub error (${status}) for ${path}`)
}

export async function readJSON(path) {
  const res = await fetch(`${API}/${path}`, { headers: HEADERS })
  if (res.status === 404) return { data: null, sha: null }
  if (!res.ok) handleError(res.status, path)
  const meta    = await res.json()
  const decoded = decodeURIComponent(escape(atob(meta.content.replace(/\n/g, ''))))
  return { data: JSON.parse(decoded), sha: meta.sha }
}

export async function writeJSON(path, data, sha = null) {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))))
  const res = await fetch(`${API}/${path}`, {
    method: 'PUT', headers: HEADERS,
    body: JSON.stringify({ message: `portal: update ${path}`, content, ...(sha ? { sha } : {}) }),
  })
  if (!res.ok) handleError(res.status, path)
  return res.json()
}

export async function listDir(path) {
  const res = await fetch(`${API}/${path}`, { headers: HEADERS })
  if (res.status === 404) return []
  if (!res.ok) handleError(res.status, path)
  const items = await res.json()
  return Array.isArray(items) ? items : []
}

export async function getSettings() {
  const { data } = await readJSON('meta/settings.json')
  return data || {}
}
export async function saveSettings(settings) {
  const { sha } = await readJSON('meta/settings.json')
  await writeJSON('meta/settings.json', settings, sha)
}

export async function getUsers() {
  const { data } = await readJSON('users.json')
  return (data || []).map(({ passwordHash, salt, ...rest }) => rest)
}
export async function getRawUsers() {
  const { data, sha } = await readJSON('users.json')
  return { users: data || [], sha }
}
export async function saveRawUsers(users, sha) {
  await writeJSON('users.json', users, sha)
}
export async function getAllFaculties() {
  const { data } = await readJSON('users.json')
  return (data || []).filter(u => u.role === 'faculty').map(({ passwordHash, salt, ...rest }) => rest)
}

export async function getFacultyRecords(tabId, userId) {
  const { data } = await readJSON(`records/${tabId}/${userId}.json`)
  return data || []
}

export async function getAllRecordsForTab(tabId) {
  const files = await listDir(`records/${tabId}`)
  const jsons = files.filter(f => f.name.endsWith('.json'))
  if (!jsons.length) return []
  const chunks = await Promise.all(jsons.map(f =>
    readJSON(`records/${tabId}/${f.name}`).then(r => r.data || [])
  ))
  return chunks.flat()
}

export async function addRecord(tabId, userId, newRecord) {
  const path          = `records/${tabId}/${userId}.json`
  const { data, sha } = await readJSON(path)
  const now           = new Date().toISOString()
  const updated       = [...(data || []), {
    ...newRecord, id: crypto.randomUUID(), createdAt: now, updatedAt: now,
    _verified: false,  // new records start unverified
  }]
  await writeJSON(path, updated, sha)
  return updated
}

export async function updateRecord(tabId, userId, recordId, changes) {
  const path          = `records/${tabId}/${userId}.json`
  const { data, sha } = await readJSON(path)
  const updated       = (data || []).map(r =>
    r.id === recordId
      ? { ...r, ...changes, updatedAt: new Date().toISOString(), _changedFields: getChangedFields(r, changes) }
      : r
  )
  await writeJSON(path, updated, sha)
  return updated
}

// Track which fields changed for audit trail
function getChangedFields(original, changes) {
  const changed = []
  for (const key of Object.keys(changes)) {
    if (key.startsWith('_')) continue
    if (String(original[key] ?? '') !== String(changes[key] ?? '')) {
      changed.push(key)
    }
  }
  return changed
}

export async function deleteRecord(tabId, userId, recordId) {
  const path          = `records/${tabId}/${userId}.json`
  const { data, sha } = await readJSON(path)
  const updated       = (data || []).filter(r => r.id !== recordId)
  await writeJSON(path, updated, sha)
  return updated
}

export async function adminDeleteRecord(tabId, userId, recordId) {
  return deleteRecord(tabId, userId, recordId)
}

// Admin: toggle verified status on a record
export async function toggleVerified(tabId, userId, recordId, verified) {
  const path          = `records/${tabId}/${userId}.json`
  const { data, sha } = await readJSON(path)
  const updated       = (data || []).map(r =>
    r.id === recordId ? { ...r, _verified: verified, _verifiedAt: new Date().toISOString() } : r
  )
  await writeJSON(path, updated, sha)
  return updated
}
