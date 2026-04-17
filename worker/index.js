/**
 * PDEU ME Portal — Cloudflare Worker Proxy v1
 * Simple proxy — PAT hidden server-side, no auth complexity.
 * Routes:
 *   GET  /api/contents/*  → GitHub read
 *   PUT  /api/contents/*  → GitHub write
 *   GET  /api/raw/*       → raw file bytes (PDFs)
 *   GET  /api/scholar/:id → Google Scholar metrics
 *   GET  /api/health      → health check
 */

const GITHUB_API = 'https://api.github.com'

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
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age':       '86400',
      ...extra,
    },
  })
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return cors(null, 204, env)

    const url  = new URL(request.url)
    const path = url.pathname

    if (path === '/api/health')
      return cors(JSON.stringify({ ok: true }), 200, env)

    if (path.startsWith('/api/contents/')) {
      const repoPath  = path.replace('/api/contents/', '')
      const githubUrl = `${GITHUB_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${repoPath}`
      const gh = {
        Authorization:  `Bearer ${env.GITHUB_PAT}`,
        Accept:         'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent':   'PDEU-ME-Portal-Worker/1.0',
      }
      if (request.method === 'GET') {
        const r = await fetch(githubUrl, { headers: gh })
        return cors(await r.text(), r.status, env, { 'Content-Type': 'application/json' })
      }
      if (request.method === 'PUT') {
        const r = await fetch(githubUrl, { method: 'PUT', headers: gh, body: await request.text() })
        return cors(await r.text(), r.status, env, { 'Content-Type': 'application/json' })
      }
      return cors('Method not allowed', 405, env)
    }

    if (path.startsWith('/api/raw/')) {
      const repoPath  = path.replace('/api/raw/', '')
      const githubUrl = `${GITHUB_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${repoPath}`
      const r = await fetch(githubUrl, {
        headers: {
          Authorization: `Bearer ${env.GITHUB_PAT}`,
          Accept:        'application/vnd.github.raw+json',
          'User-Agent':  'PDEU-ME-Portal-Worker/1.0',
        },
      })
      if (!r.ok) return cors(JSON.stringify({ error: `GitHub ${r.status}` }), r.status, env)
      const bytes = await r.arrayBuffer()
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

    if (path.startsWith('/api/scholar/')) {
      const sid = decodeURIComponent(path.replace('/api/scholar/', '')).trim()
      if (!sid || sid.length < 4) return cors(JSON.stringify({ error: 'Invalid Scholar ID' }), 400, env)
      try {
        const r = await fetch(
          `https://scholar.google.com/citations?user=${encodeURIComponent(sid)}&hl=en&pagesize=10`,
          { headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
          }}
        )
        if (!r.ok) return cors(JSON.stringify({ error: `Scholar ${r.status}` }), r.status, env)
        const html = await r.text()
        if (html.includes('gs_captcha_ccl') || html.length < 3000)
          return cors(JSON.stringify({ blocked: true }), 429, env)
        if (!html.includes('gsc_rsb_std'))
          return cors(JSON.stringify({ notfound: true }), 404, env)
        const cells = [...html.matchAll(/class="gsc_rsb_std"[^>]*>([^<]*)</g)]
        const nums  = cells.map(m => { const n = parseInt((m[1]||'').replace(/,/g,'')); return isNaN(n)?null:n })
        const nameM = html.match(/id="gsc_prf_in"[^>]*>([^<]{2,100})</)
        const pubs  = (html.match(/class="gsc_a_tr"/g)||[]).length
        return cors(JSON.stringify({
          name: nameM?nameM[1].trim():null,
          citations:nums[0], citationsSince:nums[1],
          hIndex:nums[2],    hIndexSince:nums[3],
          i10Index:nums[4],  i10Since:nums[5],
          publications:pubs||null,
          profileUrl:`https://scholar.google.com/citations?user=${sid}`,
          fetchedAt:new Date().toISOString(),
        }), 200, env)
      } catch(e) { return cors(JSON.stringify({ error: e.message }), 502, env) }
    }

    return cors('Not found', 404, env)
  },
}
