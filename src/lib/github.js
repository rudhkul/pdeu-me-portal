// ── GitHub Data Access — via Cloudflare Worker proxy ─────────
// The PAT never touches the browser. All requests go through
// the worker at VITE_WORKER_URL, which adds auth server-side.

const WORKER = import.meta.env.VITE_WORKER_URL  // e.g. https://pdeu-me-portal-proxy.rudhkul.workers.dev
const API    = `${WORKER}/api/contents`

async function ghFetch(path, options = {}) {
  const res = await fetch(`${API}/${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  return res
}

function handleError(status, path) {
  if (status === 401) throw new Error('Worker auth error. Contact the administrator.')
  if (status === 403) throw new Error('Access denied. Contact the administrator.')
  if (status === 409) throw new Error('Data conflict — someone else saved at the same time. Refresh and try again.')
  if (status >= 500)  throw new Error('Server error. Please try again in a few minutes.')
  if (status !== 404) throw new Error(`API error (${status}) for ${path}`)
}

export async function readJSON(path) {
  const res = await ghFetch(path)
  if (res.status === 404) return { data: null, sha: null }
  if (!res.ok) handleError(res.status, path)
  const meta    = await res.json()
  const decoded = decodeURIComponent(escape(atob(meta.content.replace(/\n/g, ''))))
  return { data: JSON.parse(decoded), sha: meta.sha }
}

export async function writeJSON(path, data, sha = null) {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))))
  const res = await ghFetch(path, {
    method: 'PUT',
    body:   JSON.stringify({ message: `portal: update ${path}`, content, ...(sha ? { sha } : {}) }),
  })
  if (!res.ok) handleError(res.status, path)
  return res.json()
}

export async function listDir(path) {
  const res = await ghFetch(path)
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
  const chunks = await Promise.all(
    jsons.map(f => readJSON(`records/${tabId}/${f.name}`).then(r => r.data || []))
  )
  return chunks.flat()
}

export async function addRecord(tabId, userId, newRecord) {
  const path          = `records/${tabId}/${userId}.json`
  const { data, sha } = await readJSON(path)
  const now           = new Date().toISOString()
  const updated       = [...(data || []), {
    ...newRecord,
    id:        crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    _verified: false,
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

function getChangedFields(original, changes) {
  const changed = []
  for (const key of Object.keys(changes)) {
    if (key.startsWith('_')) continue
    if (String(original[key] ?? '') !== String(changes[key] ?? '')) changed.push(key)
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

export async function toggleVerified(tabId, userId, recordId, verified) {
  const path          = `records/${tabId}/${userId}.json`
  const { data, sha } = await readJSON(path)
  const updated       = (data || []).map(r =>
    r.id === recordId
      ? { ...r, _verified: verified, _verifiedAt: new Date().toISOString() }
      : r
  )
  await writeJSON(path, updated, sha)
  return updated
}
