const GITHUB_API = 'https://api.github.com'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000
const MAX_FAILURES = 5
const LOCKOUT_MS = 15 * 60 * 1000
const attempts = new Map()

function json(body, status, env, extra = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
      'Access-Control-Max-Age': '86400',
      'Cache-Control': 'no-store',
      ...extra,
    },
  })
}

function fail(message, status, env) {
  return json({ error: message }, status, env)
}

function requiredEnv(env) {
  return env.GITHUB_PAT && env.GITHUB_OWNER && env.GITHUB_REPO && env.AUTH_SECRET && env.ALLOWED_ORIGIN
}

function githubHeaders(env, accept = 'application/vnd.github.v3+json') {
  return {
    Authorization: `Bearer ${env.GITHUB_PAT}`,
    Accept: accept,
    'Content-Type': 'application/json',
    'User-Agent': 'DIC-Mechanical-Portal/3.0',
  }
}

function repoUrl(env, repoPath) {
  const safe = repoPath.split('/').filter(Boolean).map(encodeURIComponent).join('/')
  return `${GITHUB_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${safe}`
}

async function ghGet(env, repoPath, raw = false) {
  return fetch(repoUrl(env, repoPath), {
    headers: githubHeaders(env, raw ? 'application/vnd.github.raw+json' : 'application/vnd.github.v3+json'),
  })
}

async function ghPut(env, repoPath, body) {
  return fetch(repoUrl(env, repoPath), {
    method: 'PUT',
    headers: githubHeaders(env),
    body,
  })
}

function decodeContent(meta) {
  const binary = atob(String(meta.content || '').replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

function encodeContent(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value, null, 2))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function getUsers(env) {
  const response = await ghGet(env, 'users.json')
  if (!response.ok) throw new Error(`GitHub users read failed: ${response.status}`)
  const meta = await response.json()
  return { users: decodeContent(meta), sha: meta.sha }
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

async function verifyPassword(password, user, secret) {
  return (await sha256(secret + user.salt + password)) === user.passwordHash
}

function base64UrlEncode(value) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(padded)
  return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)))
}

async function hmac(value, secret, usage) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  )
  return { key, bytes: new TextEncoder().encode(value) }
}

async function signToken(payload, secret) {
  const body = base64UrlEncode(JSON.stringify(payload))
  const { key, bytes } = await hmac(body, secret, 'sign')
  const signature = await crypto.subtle.sign('HMAC', key, bytes)
  let binary = ''
  for (const byte of new Uint8Array(signature)) binary += String.fromCharCode(byte)
  return `${body}.${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}`
}

async function verifyToken(token, secret) {
  try {
    const [body, signatureText] = token.split('.')
    if (!body || !signatureText) return null
    const padded = signatureText.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - signatureText.length % 4) % 4)
    const signature = Uint8Array.from(atob(padded), c => c.charCodeAt(0))
    const { key, bytes } = await hmac(body, secret, 'verify')
    if (!await crypto.subtle.verify('HMAC', key, signature, bytes)) return null
    const payload = JSON.parse(base64UrlDecode(body))
    if (!payload.exp || Date.now() >= payload.exp) return null
    return payload
  } catch {
    return null
  }
}

function requestToken(request) {
  const value = request.headers.get('Authorization') || request.headers.get('X-Session-Token') || ''
  return value.replace(/^Bearer\s+/i, '').trim()
}

async function authenticate(request, env) {
  const token = requestToken(request)
  return token ? verifyToken(token, env.AUTH_SECRET) : null
}

function cleanPath(prefix, pathname) {
  return pathname.slice(prefix.length).split('/').filter(Boolean).map(decodeURIComponent).join('/')
}

function facultyOwnsPath(path, userId) {
  const escaped = userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^records/tab\\d+/${escaped}\\.json$`).test(path) ||
    new RegExp(`^proofs/tab\\d+/${escaped}/[^/]+$`).test(path) ||
    new RegExp(`^profile-pictures/${escaped}/[^/]+$`).test(path)
}

function facultyCanReadPath(path, userId) {
  if (path === 'users.json' || path === 'meta/settings.json' || path === 'records/tab5') return true
  if (/^records\/tab5\/[^/]+\.json$/.test(path)) return true
  if (facultyOwnsPath(path, userId)) return true
  return path === `profile-pictures/${userId}`
}

function mime(path) {
  const extension = path.split('.').pop().toLowerCase()
  return {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
  }[extension] || 'application/octet-stream'
}

async function login(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  const now = Date.now()
  const state = attempts.get(ip) || { failures: 0, lockedUntil: 0 }
  if (state.lockedUntil > now) return fail('Too many failed attempts. Try again later.', 429, env)
  let input
  try {
    input = await request.json()
  } catch {
    return fail('Invalid request body.', 400, env)
  }
  if (!input?.email || !input?.password) return fail('Email and password are required.', 400, env)
  let users
  try {
    users = (await getUsers(env)).users
  } catch {
    return fail('Cannot reach the data repository.', 502, env)
  }
  const user = users.find(item => String(item.email).toLowerCase() === String(input.email).trim().toLowerCase())
  const valid = user ? await verifyPassword(String(input.password), user, env.AUTH_SECRET) : false
  if (!valid) {
    state.failures++
    if (state.failures >= MAX_FAILURES) {
      state.failures = 0
      state.lockedUntil = now + LOCKOUT_MS
    }
    attempts.set(ip, state)
    return fail('Incorrect email or password.', 401, env)
  }
  attempts.delete(ip)
  const session = {
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    exp: now + SESSION_TTL_MS,
  }
  return json({ ...session, token: await signToken(session, env.AUTH_SECRET) }, 200, env)
}

async function changePassword(request, env, session) {
  let input
  try {
    input = await request.json()
  } catch {
    return fail('Invalid request body.', 400, env)
  }
  if (!input?.currentPassword || String(input.newPassword || '').length < 8) {
    return fail('Current password and a new password of at least 8 characters are required.', 400, env)
  }
  const { users, sha } = await getUsers(env)
  const user = users.find(item => item.id === session.userId)
  if (!user || !await verifyPassword(String(input.currentPassword), user, env.AUTH_SECRET)) {
    return fail('Current password is incorrect.', 401, env)
  }
  user.passwordHash = await sha256(env.AUTH_SECRET + user.salt + String(input.newPassword))
  const response = await ghPut(env, 'users.json', JSON.stringify({
    message: `security: password change for ${session.userId}`,
    content: encodeContent(users),
    sha,
  }))
  if (!response.ok) return fail('Password update failed.', 502, env)
  return json({ ok: true }, 200, env)
}

function randomHex(bytes) {
  const data = new Uint8Array(bytes)
  crypto.getRandomValues(data)
  return Array.from(data, value => value.toString(16).padStart(2, '0')).join('')
}

async function adminCreateUser(request, env, session) {
  if (session.role !== 'admin') return fail('Administrator access required.', 403, env)
  let input
  try {
    input = await request.json()
  } catch {
    return fail('Invalid request body.', 400, env)
  }
  const fullName = String(input?.fullName || '').trim()
  const email = String(input?.email || '').trim().toLowerCase()
  const role = input?.role === 'admin' ? 'admin' : 'faculty'
  const password = String(input?.password || '')
  if (!fullName || !email || password.length < 8) {
    return fail('Name, email, and a password of at least 8 characters are required.', 400, env)
  }
  const { users, sha } = await getUsers(env)
  if (users.some(user => String(user.email).toLowerCase() === email)) {
    return fail('Email already exists.', 409, env)
  }
  const id = `usr_${randomHex(8)}`
  const salt = randomHex(16)
  users.push({
    id,
    fullName,
    email,
    role,
    salt,
    passwordHash: await sha256(env.AUTH_SECRET + salt + password),
  })
  const response = await ghPut(env, 'users.json', JSON.stringify({
    message: `admin: create user ${id}`,
    content: encodeContent(users),
    sha,
  }))
  if (!response.ok) return fail('User creation failed.', 502, env)
  return json({ ok: true, id }, 201, env)
}

async function adminResetPassword(request, env, session, userId) {
  if (session.role !== 'admin') return fail('Administrator access required.', 403, env)
  let input
  try {
    input = await request.json()
  } catch {
    return fail('Invalid request body.', 400, env)
  }
  const password = String(input?.newPassword || '')
  if (password.length < 8) return fail('Password must be at least 8 characters.', 400, env)
  const { users, sha } = await getUsers(env)
  const user = users.find(item => item.id === userId)
  if (!user) return fail('User not found.', 404, env)
  user.salt = randomHex(16)
  user.passwordHash = await sha256(env.AUTH_SECRET + user.salt + password)
  const response = await ghPut(env, 'users.json', JSON.stringify({
    message: `admin: reset password for ${userId}`,
    content: encodeContent(users),
    sha,
  }))
  if (!response.ok) return fail('Password reset failed.', 502, env)
  return json({ ok: true }, 200, env)
}

export default {
  async fetch(request, env) {
    if (!requiredEnv(env)) return new Response('Worker configuration incomplete.', { status: 503 })
    if (request.method === 'OPTIONS') return json(null, 204, env)
    const url = new URL(request.url)
    const path = url.pathname
    if (path === '/api/health') return json({ ok: true, version: '3.0-secure' }, 200, env)
    if (path === '/api/auth/login' && request.method === 'POST') return login(request, env)
    const session = await authenticate(request, env)
    if (!session) return fail('Authentication required.', 401, env)
    if (path === '/api/auth/verify' && request.method === 'GET') return json({ valid: true, ...session }, 200, env)
    if (path === '/api/auth/change-password' && request.method === 'POST') return changePassword(request, env, session)

    if (path === '/api/admin/users' && request.method === 'POST') {
      return adminCreateUser(request, env, session)
    }
    const passwordMatch = path.match(/^\/api\/admin\/users\/([^/]+)\/password$/)
    if (passwordMatch && request.method === 'POST') {
      return adminResetPassword(request, env, session, decodeURIComponent(passwordMatch[1]))
    }

    if (path.startsWith('/api/contents/')) {
      const repoPath = cleanPath('/api/contents/', path)
      if (!repoPath || repoPath.includes('..')) return fail('Invalid repository path.', 400, env)
      if (request.method === 'GET') {
        if (session.role !== 'admin' && !facultyCanReadPath(repoPath, session.userId)) {
          return fail('Access denied.', 403, env)
        }
        const response = await ghGet(env, repoPath)
        if (repoPath === 'users.json' && response.ok && session.role !== 'admin') {
          const meta = await response.json()
          const sanitized = decodeContent(meta).map(({ passwordHash, salt, ...user }) => user)
          return json({ ...meta, content: encodeContent(sanitized) }, 200, env)
        }
        return new Response(await response.arrayBuffer(), {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
            'Cache-Control': 'no-store',
          },
        })
      }
      if (request.method === 'PUT') {
        if (repoPath === 'users.json' && session.role !== 'admin') return fail('Administrator access required.', 403, env)
        if (session.role !== 'admin' && !facultyOwnsPath(repoPath, session.userId)) {
          return fail('You may modify only your own records and files.', 403, env)
        }
        const response = await ghPut(env, repoPath, await request.text())
        return new Response(await response.arrayBuffer(), {
          status: response.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
            'Cache-Control': 'no-store',
          },
        })
      }
      return fail('Method not allowed.', 405, env)
    }

    if (path.startsWith('/api/raw/') && request.method === 'GET') {
      const repoPath = cleanPath('/api/raw/', path)
      if (!repoPath || repoPath.includes('..')) return fail('Invalid repository path.', 400, env)
      if (session.role !== 'admin' && !facultyOwnsPath(repoPath, session.userId)) return fail('Access denied.', 403, env)
      const response = await ghGet(env, repoPath, true)
      if (!response.ok) return fail(`Stored file unavailable (${response.status}).`, response.status, env)
      return new Response(await response.arrayBuffer(), {
        status: 200,
        headers: {
          'Content-Type': mime(repoPath),
          'Content-Disposition': `inline; filename="${repoPath.split('/').pop()}"`,
          'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
          'Cache-Control': 'private, no-store',
        },
      })
    }

    if (path.startsWith('/api/scholar/') && request.method === 'GET') {
      const scholarId = decodeURIComponent(path.slice('/api/scholar/'.length)).trim()
      if (!/^[A-Za-z0-9_-]{4,64}$/.test(scholarId)) return fail('Invalid Scholar ID.', 400, env)
      const response = await fetch(`https://scholar.google.com/citations?user=${encodeURIComponent(scholarId)}&hl=en&pagesize=10`)
      if (!response.ok) return fail(`Scholar returned ${response.status}.`, response.status, env)
      const html = await response.text()
      const cells = [...html.matchAll(/class="gsc_rsb_std"[^>]*>([^<]*)</g)]
      const values = cells.map(match => Number.parseInt(match[1].replace(/,/g, ''), 10)).map(value => Number.isNaN(value) ? null : value)
      const name = html.match(/id="gsc_prf_in"[^>]*>([^<]{2,100})</)?.[1]?.trim() || null
      return json({ name, citations: values[0], citationsSince: values[1], hIndex: values[2], hIndexSince: values[3], i10Index: values[4], i10Since: values[5], profileUrl: `https://scholar.google.com/citations?user=${scholarId}`, fetchedAt: new Date().toISOString() }, 200, env)
    }

    return fail('Not found.', 404, env)
  },
}
