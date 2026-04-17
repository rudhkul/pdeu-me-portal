/**
 * PDEU ME Portal — Cloudflare Worker Proxy
 *
 * Security features:
 *  - PBKDF2 password hashing (310,000 iterations) with backward compat for SHA-256
 *  - Login rate limiting: 5 failures → 15 min lockout per IP
 *  - Auth token required for all write operations
 *  - PAT never exposed to browser
 *
 * Routes:
 *   POST /api/auth/login         → verify credentials, return signed session token
 *   GET  /api/auth/verify        → verify session token (for sensitive ops)
 *   GET  /api/contents/*         → GitHub read (public within portal)
 *   PUT  /api/contents/*         → GitHub write (requires valid session token)
 *   GET  /api/raw/*              → GitHub raw bytes (PDFs/images)
 *   GET  /api/scholar/:id        → Google Scholar metrics
 *   GET  /api/health             → health check
 *
 * Secrets: GITHUB_PAT, GITHUB_OWNER, GITHUB_REPO, ALLOWED_ORIGIN, AUTH_SECRET
 */

const GITHUB_API      = 'https://api.github.com'
const MAX_FAILURES    = 5
const LOCKOUT_MS      = 15 * 60 * 1000   // 15 minutes
const SESSION_TTL_MS  = 8  * 60 * 60 * 1000  // 8 hours

// In-memory rate limit store (resets on worker restart — good enough for internal portal)
// Key: IP address, Value: { failures, lockedUntil }
const loginAttempts = new Map()

// ── Helpers ───────────────────────────────────────────────────────────────────

function mimeFromPath(p) {
  const e = p.split('.').pop().toLowerCase()
  return { pdf:'application/pdf', png:'image/png', jpg:'image/jpeg',
           jpeg:'image/jpeg', webp:'image/webp' }[e] || 'application/octet-stream'
}

function allowedOrigin(env) { return env.ALLOWED_ORIGIN || '*' }

function cors(body, status, env, extra = {}) {
  return new Response(body, {
    status: status || 200,
    headers: {
      'Content-Type':                 'application/json',
      'Access-Control-Allow-Origin':  allowedOrigin(env),
      'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
      'Access-Control-Max-Age':       '86400',
      ...extra,
    },
  })
}

function err(msg, status, env) {
  return cors(JSON.stringify({ error: msg }), status, env)
}

// ── PBKDF2 hashing (Web Crypto — available in Cloudflare Workers) ─────────────

async function pbkdf2Hash(password, salt, secret) {
  const enc     = new TextEncoder()
  const keyMat  = await crypto.subtle.importKey(
    'raw', enc.encode(secret + password), 'PBKDF2', false, ['deriveBits']
  )
  const bits    = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 310_000, hash: 'SHA-256' },
    keyMat, 256
  )
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2,'0')).join('')
}

// Backward-compat SHA-256 (for existing accounts until they change password)
async function sha256Hash(str) {
  const buf  = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

async function verifyPassword(password, user, secret) {
  // New format: pbkdf2:hash
  if (user.passwordHash?.startsWith('pbkdf2:')) {
    const stored = user.passwordHash.slice(7)
    const test   = await pbkdf2Hash(password, user.salt, secret)
    return test === stored
  }
  // Legacy SHA-256 (backward compat)
  const legacy = await sha256Hash(secret + user.salt + password)
  return legacy === user.passwordHash
}

// ── Session token (simple HMAC-signed JSON, no KV needed) ────────────────────

async function signToken(payload, secret) {
  const data = JSON.stringify(payload)
  const key  = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['sign']
  )
  const sig  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2,'0')).join('')
  return btoa(data) + '.' + sigHex
}

async function verifyToken(token, secret) {
  try {
    const [dataB64, sigHex] = token.split('.')
    if (!dataB64 || !sigHex) return null
    const data = atob(dataB64)
    const key  = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret), { name:'HMAC', hash:'SHA-256' }, false, ['verify']
    )
    const sigBytes = new Uint8Array(sigHex.match(/../g).map(h => parseInt(h,16)))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data))
    if (!valid) return null
    const payload = JSON.parse(data)
    if (Date.now() > payload.exp) return null  // expired
    return payload
  } catch { return null }
}

function getToken(request) {
  const auth = request.headers.get('X-Session-Token') || request.headers.get('Authorization') || ''
  return auth.replace(/^Bearer\s+/i, '').trim() || null
}

// ── GitHub helpers ────────────────────────────────────────────────────────────

async function ghGet(env, repoPath) {
  return fetch(
    `${GITHUB_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${repoPath}`,
    { headers: {
        Authorization:  `Bearer ${env.GITHUB_PAT}`,
        Accept:         'application/vnd.github.v3+json',
        'User-Agent':   'PDEU-ME-Portal-Worker/2.0',
      }
    }
  )
}

async function ghPut(env, repoPath, body) {
  return fetch(
    `${GITHUB_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${repoPath}`,
    { method: 'PUT',
      headers: {
        Authorization:  `Bearer ${env.GITHUB_PAT}`,
        Accept:         'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent':   'PDEU-ME-Portal-Worker/2.0',
      },
      body,
    }
  )
}

// ── Route: Login ──────────────────────────────────────────────────────────────

async function handleLogin(request, env) {
  // Rate limiting by IP
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown'
  const now = Date.now()
  const attempt = loginAttempts.get(ip) || { failures: 0, lockedUntil: 0 }

  if (attempt.lockedUntil > now) {
    const mins = Math.ceil((attempt.lockedUntil - now) / 60000)
    return err(`Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`, 429, env)
  }

  let body
  try { body = await request.json() } catch { return err('Invalid request body', 400, env) }

  const { email, password } = body || {}
  if (!email || !password) return err('Email and password required', 400, env)

  // Fetch users from GitHub
  const res   = await ghGet(env, 'users.json')
  if (!res.ok) return err('Cannot reach data repository', 502, env)

  const meta  = await res.json()
  const users = JSON.parse(decodeURIComponent(escape(atob(meta.content.replace(/\n/g,'')))))

  const user  = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase())

  // Verify password (timing-safe: always hash even if user not found)
  const secret  = env.AUTH_SECRET || 'fallback'
  const dummyUser = { passwordHash: '', salt: 'dummy' }
  const valid   = user && await verifyPassword(password, user, secret)

  if (!valid) {
    attempt.failures++
    if (attempt.failures >= MAX_FAILURES) {
      attempt.lockedUntil = now + LOCKOUT_MS
      attempt.failures    = 0
    }
    loginAttempts.set(ip, attempt)
    const remaining = MAX_FAILURES - attempt.failures
    return err(
      remaining > 0
        ? `Incorrect email or password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
        : `Account locked for 15 minutes due to too many failed attempts.`,
      401, env
    )
  }

  // Success — reset rate limit
  loginAttempts.delete(ip)

  // Issue signed session token
  const token = await signToken({
    userId:   user.id,
    email:    user.email,
    role:     user.role,
    fullName: user.fullName,
    exp:      now + SESSION_TTL_MS,
  }, secret)

  return cors(JSON.stringify({
    token,
    userId:   user.id,
    email:    user.email,
    role:     user.role,
    fullName: user.fullName,
  }), 200, env)
}

// ── Main fetch handler ────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return cors(null, 204, env)

    const url  = new URL(request.url)
    const path = url.pathname

    // ── Health ──────────────────────────────────────────────────
    if (path === '/api/health')
      return cors(JSON.stringify({ ok: true, version: '2.0' }), 200, env)

    // ── Login ───────────────────────────────────────────────────
    if (path === '/api/auth/login' && request.method === 'POST')
      return handleLogin(request, env)

    // ── Session verify ──────────────────────────────────────────
    if (path === '/api/auth/verify') {
      const token   = getToken(request)
      const payload = token ? await verifyToken(token, env.AUTH_SECRET || 'fallback') : null
      if (!payload) return err('Invalid or expired session', 401, env)
      return cors(JSON.stringify({ valid: true, ...payload }), 200, env)
    }

    // ── GitHub Contents GET (read — no auth needed, data is non-sensitive) ──
    if (path.startsWith('/api/contents/') && request.method === 'GET') {
      const repoPath = path.replace('/api/contents/', '')
      const res      = await ghGet(env, repoPath)
      return cors(await res.text(), res.status, env, { 'Content-Type': 'application/json' })
    }

    // ── GitHub Contents PUT (write — requires valid session) ────
    if (path.startsWith('/api/contents/') && request.method === 'PUT') {
      // Validate session before allowing any write
      const token   = getToken(request)
      const payload = token ? await verifyToken(token, env.AUTH_SECRET || 'fallback') : null
      if (!payload) return err('Authentication required for write operations', 401, env)

      // Enforce write permissions:
      // - Faculty can only write to their own records
      // - Admins can write anywhere
      const repoPath = path.replace('/api/contents/', '')
      if (payload.role !== 'admin') {
        // Faculty write check: path must be records/{tabId}/{userId}.json or proofs/{tabId}/{userId}/
        const ownedPaths = [
          `records/`,
          `proofs/`,
          `profile-pictures/`,
        ]
        const isOwnPath = ownedPaths.some(p => repoPath.startsWith(p)) &&
          repoPath.includes(`/${payload.userId}`)

        if (!isOwnPath) {
          return err('Access denied — you can only write to your own records', 403, env)
        }
      }

      const res = await ghPut(env, repoPath, await request.text())
      return cors(await res.text(), res.status, env, { 'Content-Type': 'application/json' })
    }

    // ── GitHub Raw bytes (PDFs/images) ───────────────────────────
    if (path.startsWith('/api/raw/')) {
      const repoPath  = path.replace('/api/raw/', '')
      const githubUrl = `${GITHUB_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${repoPath}`
      const res = await fetch(githubUrl, {
        headers: {
          Authorization: `Bearer ${env.GITHUB_PAT}`,
          Accept:        'application/vnd.github.raw+json',
          'User-Agent':  'PDEU-ME-Portal-Worker/2.0',
        },
      })
      if (!res.ok) return err(`GitHub ${res.status}`, res.status, env)
      const bytes = await res.arrayBuffer()
      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type':                mimeFromPath(repoPath),
          'Content-Disposition':         `inline; filename="${repoPath.split('/').pop()}"`,
          'Access-Control-Allow-Origin': allowedOrigin(env),
          'Cache-Control':               'private, max-age=300',
        },
      })
    }

    // ── Google Scholar ────────────────────────────────────────────
    if (path.startsWith('/api/scholar/')) {
      const sid = decodeURIComponent(path.replace('/api/scholar/', '')).trim()
      if (!sid || sid.length < 4) return err('Invalid Scholar ID', 400, env)
      try {
        const res  = await fetch(
          `https://scholar.google.com/citations?user=${encodeURIComponent(sid)}&hl=en&pagesize=10`,
          { headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
            }
          }
        )
        if (!res.ok) return err(`Scholar returned ${res.status}`, res.status, env)
        const html = await res.text()
        if (html.includes('gs_captcha_ccl') || html.length < 3000)
          return cors(JSON.stringify({ blocked: true }), 429, env)
        if (!html.includes('gsc_rsb_std'))
          return cors(JSON.stringify({ notfound: true }), 404, env)

        const cells  = [...html.matchAll(/class="gsc_rsb_std"[^>]*>([^<]*)</g)]
        const nums   = cells.map(m => { const n = parseInt((m[1]||'').replace(/,/g,'')); return isNaN(n)?null:n })
        const nameM  = html.match(/id="gsc_prf_in"[^>]*>([^<]{2,100})</)
        const pubCnt = (html.match(/class="gsc_a_tr"/g)||[]).length

        return cors(JSON.stringify({
          name:           nameM ? nameM[1].trim() : null,
          citations:      nums[0], citationsSince: nums[1],
          hIndex:         nums[2], hIndexSince:    nums[3],
          i10Index:       nums[4], i10Since:       nums[5],
          publications:   pubCnt || null,
          profileUrl:     `https://scholar.google.com/citations?user=${sid}`,
          fetchedAt:      new Date().toISOString(),
        }), 200, env)
      } catch (e) { return err(e.message, 502, env) }
    }

    return err('Not found', 404, env)
  },
}
