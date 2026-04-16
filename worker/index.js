/**
 * PDEU ME Portal — Cloudflare Worker Proxy
 *
 * Sits between the browser and the GitHub API.
 * The PAT never leaves this worker — it is stored as a
 * Cloudflare secret and injected here at request time.
 *
 * Routes (all prefixed with /api/):
 *   GET  /api/contents/*   → GitHub Contents API (read file / list dir)
 *   PUT  /api/contents/*   → GitHub Contents API (write file)
 *   GET  /api/raw/*        → GitHub raw file bytes (PDFs, images)
 *   GET  /api/health       → returns 200 OK (for testing)
 *
 * Environment variables (set as Cloudflare secrets):
 *   GITHUB_PAT             → fine-grained PAT, Contents R/W on pdeu-me-data only
 *   GITHUB_OWNER           → rudhkul
 *   GITHUB_REPO            → pdeu-me-data
 *   ALLOWED_ORIGIN         → https://rudhkul.github.io  (your portal URL)
 */

const GITHUB_API = 'https://api.github.com'

export default {
  async fetch(request, env) {
    // ── CORS pre-flight ───────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204, env)
    }

    const url  = new URL(request.url)
    const path = url.pathname  // e.g. /api/contents/users.json

    // ── Health check ──────────────────────────────────────────
    if (path === '/api/health') {
      return corsResponse(JSON.stringify({ ok: true }), 200, env)
    }

    // ── Route: /api/contents/* ────────────────────────────────
    if (path.startsWith('/api/contents/')) {
      const repoPath  = path.replace('/api/contents/', '')
      const githubUrl = `${GITHUB_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${repoPath}`

      const githubHeaders = {
        Authorization:  `Bearer ${env.GITHUB_PAT}`,
        Accept:         'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent':   'PDEU-ME-Portal-Worker/1.0',
      }

      if (request.method === 'GET') {
        const res  = await fetch(githubUrl, { headers: githubHeaders })
        const body = await res.text()
        return corsResponse(body, res.status, env, {
          'Content-Type': 'application/json',
        })
      }

      if (request.method === 'PUT') {
        const body = await request.text()
        const res  = await fetch(githubUrl, {
          method:  'PUT',
          headers: githubHeaders,
          body,
        })
        const resBody = await res.text()
        return corsResponse(resBody, res.status, env, {
          'Content-Type': 'application/json',
        })
      }

      return corsResponse('Method not allowed', 405, env)
    }

    // ── Route: /api/raw/* ─────────────────────────────────────
    // Returns raw file bytes (PDFs, images). Used for proof download.
    if (path.startsWith('/api/raw/')) {
      const repoPath  = path.replace('/api/raw/', '')
      const githubUrl = `${GITHUB_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${repoPath}`

      const res = await fetch(githubUrl, {
        headers: {
          Authorization: `Bearer ${env.GITHUB_PAT}`,
          Accept:        'application/vnd.github.raw+json',   // returns raw bytes
          'User-Agent':  'PDEU-ME-Portal-Worker/1.0',
        },
      })

      if (!res.ok) {
        return corsResponse(
          JSON.stringify({ error: `GitHub ${res.status}` }),
          res.status, env
        )
      }

      // Stream raw bytes back with correct content type
      const blob        = await res.blob()
      const contentType = res.headers.get('Content-Type') || 'application/octet-stream'
      return new Response(blob, {
        status: 200,
        headers: {
          'Content-Type':                contentType,
          'Access-Control-Allow-Origin': allowedOrigin(env),
          'Cache-Control':               'private, max-age=300',
        },
      })
    }

    return corsResponse('Not found', 404, env)
  },
}

// ── Helpers ───────────────────────────────────────────────────

function allowedOrigin(env) {
  // Allow both the GitHub Pages URL and localhost for dev
  return env.ALLOWED_ORIGIN || '*'
}

function corsResponse(body, status, env, extraHeaders = {}) {
  const headers = {
    'Content-Type':                     'application/json',
    'Access-Control-Allow-Origin':      allowedOrigin(env),
    'Access-Control-Allow-Methods':     'GET, PUT, OPTIONS',
    'Access-Control-Allow-Headers':     'Content-Type, Authorization',
    'Access-Control-Max-Age':           '86400',
    ...extraHeaders,
  }
  return new Response(body, { status: status || 200, headers })
}
