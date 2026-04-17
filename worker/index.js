/**
 * PDEU ME Portal — Cloudflare Worker Proxy
 *
 * Routes:
 *   GET  /api/contents/*    → GitHub Contents API (read / list)
 *   PUT  /api/contents/*    → GitHub Contents API (write)
 *   GET  /api/raw/*         → GitHub raw file bytes (PDFs, images)
 *   GET  /api/scholar/:id   → Google Scholar metrics (server-side fetch)
 *   GET  /api/health        → health check
 */

const GITHUB_API = 'https://api.github.com'

function mimeFromPath(p) {
  const e = p.split('.').pop().toLowerCase()
  return { pdf:'application/pdf', png:'image/png', jpg:'image/jpeg',
           jpeg:'image/jpeg', webp:'image/webp' }[e] || 'application/octet-stream'
}

function parseNum(str) {
  const n = parseInt((str || '').replace(/,/g, '').trim())
  return isNaN(n) ? null : n
}

function extractScholarMetrics(html) {
  // Target cells with class gsc_rsb_std — these are EXACTLY the stat numbers.
  // Order in the page: citations-all, citations-since, h-all, h-since, i10-all, i10-since
  const cells = [...html.matchAll(/class="gsc_rsb_std"[^>]*>([^<]*)</g)]
  const nums  = cells.map(m => parseNum(m[1]))

  // Only proceed if we got at least 6 numbers
  if (nums.length < 6) return null

  return {
    citations:      nums[0],
    citationsSince: nums[1],
    hIndex:         nums[2],
    hIndexSince:    nums[3],
    i10Index:       nums[4],
    i10Since:       nums[5],
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return cors(null, 204, env)

    const url  = new URL(request.url)
    const path = url.pathname

    // ── Health ──────────────────────────────────────────────────
    if (path === '/api/health')
      return cors(JSON.stringify({ ok: true }), 200, env)

    // ── Google Scholar ──────────────────────────────────────────
    if (path.startsWith('/api/scholar/')) {
      const sid = decodeURIComponent(path.replace('/api/scholar/', '')).trim()

      if (!sid || sid.length < 4)
        return cors(JSON.stringify({ error: 'Invalid Scholar ID' }), 400, env)

      try {
        const res = await fetch(
          `https://scholar.google.com/citations?user=${encodeURIComponent(sid)}&hl=en&pagesize=10`,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Cache-Control':   'no-cache',
            },
            redirect: 'follow',
          }
        )

        if (!res.ok)
          return cors(JSON.stringify({ error: `Scholar returned HTTP ${res.status}` }), res.status, env)

        const html = await res.text()

        // Detect CAPTCHA / bot block
        if (
          html.includes('gs_captcha_ccl') ||
          html.includes('not a robot') ||
          html.includes('/sorry/') ||
          html.length < 3000
        ) {
          return cors(JSON.stringify({ blocked: true }), 429, env)
        }

        // Detect profile not found
        if (html.includes('There is no Google Scholar profile') || !html.includes('gsc_rsb_std')) {
          return cors(JSON.stringify({ notfound: true }), 404, env)
        }

        // Extract stats — gsc_rsb_std cells are the ONLY place these numbers appear
        const stats = extractScholarMetrics(html)

        if (!stats) {
          return cors(JSON.stringify({ blocked: true, reason: 'parse_failed' }), 422, env)
        }

        // Extract name
        const nameM = html.match(/id="gsc_prf_in"[^>]*>([^<]{2,100})</)
        // Extract affiliation (first gsc_prf_il div — institution line)
        const affM  = html.match(/class="gsc_prf_il"[^>]*>([^<]{2,150})</)
        // Count publication rows
        const pubCount = (html.match(/class="gsc_a_tr"/g) || []).length

        return cors(JSON.stringify({
          name:        nameM ? nameM[1].trim() : null,
          affiliation: affM  ? affM[1].trim()  : null,
          ...stats,
          publications: pubCount || null,
          profileUrl:  `https://scholar.google.com/citations?user=${sid}`,
          fetchedAt:   new Date().toISOString(),
        }), 200, env)

      } catch (e) {
        return cors(JSON.stringify({ error: e.message }), 502, env)
      }
    }

    // ── GitHub Contents ──────────────────────────────────────────
    if (path.startsWith('/api/contents/')) {
      const repoPath  = path.replace('/api/contents/', '')
      const githubUrl = `${GITHUB_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${repoPath}`
      const gh        = {
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

    // ── GitHub Raw bytes (PDFs / images) ────────────────────────
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

    return cors('Not found', 404, env)
  },
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
