/**
 * PDEU ME Portal — Cloudflare Worker Proxy
 *
 * Routes:
 *   GET  /api/contents/*   → GitHub Contents API (read file / list dir)
 *   PUT  /api/contents/*   → GitHub Contents API (write file)
 *   GET  /api/raw/*        → GitHub raw file bytes (PDFs, images)
 *   GET  /api/health       → health check
 *
 * Secrets: GITHUB_PAT, GITHUB_OWNER, GITHUB_REPO, ALLOWED_ORIGIN
 */

const GITHUB_API = 'https://api.github.com'

// Derive content-type from file extension — never trust GitHub's header for PDFs
function contentTypeFromPath(path) {
  const ext = path.split('.').pop().toLowerCase()
  const map = {
    pdf:  'application/pdf',
    jpg:  'image/jpeg',
    jpeg: 'image/jpeg',
    png:  'image/png',
    webp: 'image/webp',
    json: 'application/json',
  }
  return map[ext] || 'application/octet-stream'
}

export default {
  async fetch(request, env) {

    if (request.method === 'OPTIONS') return corsResponse(null, 204, env)

    const url  = new URL(request.url)
    const path = url.pathname

    // ── Health ────────────────────────────────────────────────
    if (path === '/api/health') {
      return corsResponse(JSON.stringify({ ok: true }), 200, env)
    }

    // ── Contents API (JSON files, directory listings) ─────────
    if (path.startsWith('/api/contents/')) {
      const repoPath  = path.replace('/api/contents/', '')
      const githubUrl = `${GITHUB_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${repoPath}`
      const headers   = {
        Authorization:  `Bearer ${env.GITHUB_PAT}`,
        Accept:         'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent':   'PDEU-ME-Portal-Worker/1.0',
      }

      if (request.method === 'GET') {
        const res  = await fetch(githubUrl, { headers })
        const body = await res.text()
        return corsResponse(body, res.status, env, { 'Content-Type': 'application/json' })
      }

      if (request.method === 'PUT') {
        const res = await fetch(githubUrl, {
          method: 'PUT', headers,
          body: await request.text(),
        })
        return corsResponse(await res.text(), res.status, env, { 'Content-Type': 'application/json' })
      }

      return corsResponse('Method not allowed', 405, env)
    }

    // ── Raw file bytes (PDFs, images) ─────────────────────────
    if (path.startsWith('/api/raw/')) {
      const repoPath  = path.replace('/api/raw/', '')
      const githubUrl = `${GITHUB_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${repoPath}`

      const res = await fetch(githubUrl, {
        headers: {
          Authorization: `Bearer ${env.GITHUB_PAT}`,
          Accept:        'application/vnd.github.raw+json',  // raw bytes, not base64 JSON
          'User-Agent':  'PDEU-ME-Portal-Worker/1.0',
        },
      })

      if (!res.ok) {
        return corsResponse(
          JSON.stringify({ error: `GitHub ${res.status}` }), res.status, env
        )
      }

      const bytes       = await res.arrayBuffer()
      // Always derive content-type from the file path — never trust GitHub's header
      const contentType = contentTypeFromPath(repoPath)

      return new Response(bytes, {
        status: 200,
        headers: {
          'Content-Type':                contentType,
          'Content-Disposition':         `inline; filename="${repoPath.split('/').pop()}"`,
          'Access-Control-Allow-Origin': allowedOrigin(env),
          'Cache-Control':               'private, max-age=300',
        },
      })
    }

    return corsResponse('Not found', 404, env)
  },
}

function allowedOrigin(env) { return env.ALLOWED_ORIGIN || '*' }

function corsResponse(body, status, env, extraHeaders = {}) {
  return new Response(body, {
    status: status || 200,
    headers: {
      'Content-Type':                 'application/json',
      'Access-Control-Allow-Origin':  allowedOrigin(env),
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age':       '86400',
      ...extraHeaders,
    },
  })
}
