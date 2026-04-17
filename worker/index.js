/**
 * PDEU ME Portal — Cloudflare Worker Proxy
 *
 * Routes:
 *   GET  /api/contents/*      → GitHub Contents API (read / list)
 *   PUT  /api/contents/*      → GitHub Contents API (write)
 *   GET  /api/raw/*           → GitHub raw file bytes (PDFs, images)
 *   GET  /api/scholar/:id     → Google Scholar profile metrics (server-side fetch)
 *   GET  /api/health          → health check
 *
 * Secrets: GITHUB_PAT, GITHUB_OWNER, GITHUB_REPO, ALLOWED_ORIGIN
 */

const GITHUB_API = 'https://api.github.com'

function contentTypeFromPath(path) {
  const ext = path.split('.').pop().toLowerCase()
  return ({ pdf:'application/pdf', jpg:'image/jpeg', jpeg:'image/jpeg',
            png:'image/png', webp:'image/webp', json:'application/json' })[ext]
    || 'application/octet-stream'
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return cors(null, 204, env)

    const url  = new URL(request.url)
    const path = url.pathname

    // ── Health ────────────────────────────────────────────────
    if (path === '/api/health')
      return cors(JSON.stringify({ ok: true }), 200, env)

    // ── Google Scholar metrics ────────────────────────────────
    if (path.startsWith('/api/scholar/')) {
      const scholarId = path.replace('/api/scholar/', '').trim()
      if (!scholarId || scholarId.length < 4)
        return cors(JSON.stringify({ error: 'Invalid Scholar ID' }), 400, env)

      try {
        // Try the JSON-like endpoint Scholar uses internally for its own UI
        // This is less likely to get bot-checked than the full HTML page
        const scholarUrl =
          `https://scholar.google.com/citations?user=${encodeURIComponent(scholarId)}&hl=en&view_op=list_works&pagesize=10`

        const res = await fetch(scholarUrl, {
          headers: {
            'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control':   'no-cache',
            'Pragma':          'no-cache',
            'Sec-Fetch-Dest':  'document',
            'Sec-Fetch-Mode':  'navigate',
            'Sec-Fetch-Site':  'none',
            'Upgrade-Insecure-Requests': '1',
          },
          redirect: 'follow',
        })

        if (!res.ok)
          return cors(JSON.stringify({ error: `Scholar returned HTTP ${res.status}. Try again in a moment.` }), res.status, env)

        const html = await res.text()

        // Detect bot/CAPTCHA page — Scholar serves these when it blocks the request
        if (
          html.includes('gs_captcha_ccl') ||
          html.includes('Please show you') ||
          html.includes('not a robot') ||
          html.includes('captcha') ||
          html.length < 2000
        ) {
          return cors(JSON.stringify({
            error: 'blocked',
            message: 'Google Scholar is rate-limiting this server. Enter your metrics manually below.',
          }), 429, env)
        }

        // Detect "profile not found"
        if (html.includes('There is no Google Scholar profile') || html.includes('gsc_rch_cnt">0<')) {
          return cors(JSON.stringify({ error: 'notfound', message: 'No Google Scholar profile found for this ID.' }), 404, env)
        }

        // ── Parse stats table #gsc_rsb_st ──
        // Structure: row1=header, row2=Citations, row3=h-index, row4=i10-index
        // Each data row: <td>all-time</td><td>since 2019</td>
        const tableMatch = html.match(/id="gsc_rsb_st"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)
        let citations = null, hIndex = null, i10Index = null
        let citationsSince = null, hIndexSince = null, i10Since = null

        if (tableMatch) {
          const rows = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
          const nums = rowHtml => {
            const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
            return cells.map(c => {
              const txt = c[1].replace(/<[^>]+>/g, '').trim()
              const n   = parseInt(txt.replace(/,/g, ''))
              return isNaN(n) ? null : n
            })
          }
          if (rows[0]) { const n = nums(rows[0][1]); citations  = n[0]; citationsSince = n[1] }
          if (rows[1]) { const n = nums(rows[1][1]); hIndex     = n[0]; hIndexSince    = n[1] }
          if (rows[2]) { const n = nums(rows[2][1]); i10Index   = n[0]; i10Since       = n[1] }
        }

        // ── Parse name, affiliation ──
        const nameMatch = html.match(/id="gsc_prf_in"[^>]*>([^<]{2,80})<\/div>/)
        const affMatch  = html.match(/class="gsc_prf_il"[^>]*>([^<]{2,120})</)
        const pubCount  = (html.match(/class="gsc_a_tr"/g) || []).length

        const data = {
          name:          nameMatch ? nameMatch[1].trim() : null,
          affiliation:   affMatch  ? affMatch[1].trim()  : null,
          citations,      citationsSince,
          hIndex,         hIndexSince,
          i10Index,       i10Since,
          publications:  pubCount  || null,
          profileUrl:    `https://scholar.google.com/citations?user=${scholarId}`,
          fetchedAt:     new Date().toISOString(),
        }

        return cors(JSON.stringify(data), 200, env, { 'Content-Type': 'application/json' })

      } catch (e) {
        return cors(JSON.stringify({ error: e.message }), 502, env)
      }
    }

    // ── GitHub Contents (JSON read/write) ─────────────────────
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
        const res = await fetch(githubUrl, { headers })
        return cors(await res.text(), res.status, env, { 'Content-Type': 'application/json' })
      }
      if (request.method === 'PUT') {
        const res = await fetch(githubUrl, { method: 'PUT', headers, body: await request.text() })
        return cors(await res.text(), res.status, env, { 'Content-Type': 'application/json' })
      }
      return cors('Method not allowed', 405, env)
    }

    // ── GitHub Raw bytes (PDFs, images) ──────────────────────
    if (path.startsWith('/api/raw/')) {
      const repoPath  = path.replace('/api/raw/', '')
      const githubUrl = `${GITHUB_API}/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${repoPath}`

      const res = await fetch(githubUrl, {
        headers: {
          Authorization: `Bearer ${env.GITHUB_PAT}`,
          Accept:        'application/vnd.github.raw+json',
          'User-Agent':  'PDEU-ME-Portal-Worker/1.0',
        },
      })
      if (!res.ok)
        return cors(JSON.stringify({ error: `GitHub ${res.status}` }), res.status, env)

      const bytes       = await res.arrayBuffer()
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
