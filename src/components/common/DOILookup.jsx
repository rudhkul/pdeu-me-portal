import { useState } from 'react'
import toast from 'react-hot-toast'

const PDEU_AFFIL = 'Department of Mechanical Engineering, School of Technology, Pandit Deendayal Energy University, Gandhinagar 382426, India'

/**
 * DOI Lookup for the Publications tab.
 * Uses CrossRef public API (free, no key).
 *
 * Note on affiliations:
 *   CrossRef often omits affiliation data — it's supplied by publishers and many skip it.
 *   We auto-set the submitting faculty's affiliation to PDEU.
 *   Co-author affiliations are filled where CrossRef provides them.
 */
export default function DOILookup({ onFill, facultyName }) {
  const [doi,     setDoi]     = useState('')
  const [loading, setLoading] = useState(false)
  const [result,  setResult]  = useState(null)   // last fetched work object

  async function lookup() {
    const cleaned = doi.trim()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')
      .replace(/^doi:\s*/i, '')
      .trim()

    if (!cleaned) { toast.error('Enter a DOI first'); return }

    setLoading(true)
    setResult(null)
    try {
      // 10-second timeout — CrossRef can be slow on some networks
      const controller = new AbortController()
      const timer      = setTimeout(() => controller.abort(), 10000)

      let res
      try {
        res = await fetch(
          `https://api.crossref.org/works/${encodeURIComponent(cleaned)}`,
          {
            signal: controller.signal,
            // Note: User-Agent header is blocked by browsers in fetch() — that's fine,
            // CrossRef doesn't require it from browser clients
          }
        )
      } catch (fetchErr) {
        if (fetchErr.name === 'AbortError') {
          throw new Error('Request timed out. CrossRef may be slow — please try again.')
        }
        // NetworkError — likely CORS or offline
        throw new Error('Cannot reach CrossRef API. Check your internet connection and try again. If on a restricted network (VPN/proxy), CrossRef may be blocked.')
      } finally {
        clearTimeout(timer)
      }

      if (res.status === 404) throw new Error('DOI not found. Double-check the DOI and try again.')
      if (!res.ok)            throw new Error(`CrossRef error (${res.status}). Try again shortly.`)

      const { message: w } = await res.json()
      setResult(w)
      const fields = buildFields(w, facultyName)

      onFill(fields)
      const n = Object.keys(fields).length
      toast.success(`Auto-filled ${n} fields! Check and add what's missing.`)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-2">
        🔍 Auto-fill from DOI
        <span className="font-normal text-xs text-blue-500 dark:text-blue-400">— powered by CrossRef</span>
      </p>
      <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
        Paste your DOI to auto-fill title, authors, journal, volume, pages, and more.
        Affiliations from CrossRef are often incomplete — we'll set yours to PDEU automatically.
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={doi}
          onChange={e => setDoi(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), lookup())}
          placeholder="e.g.  10.1016/j.energy.2024.123456  or paste the full DOI URL"
          className="form-input flex-1 font-mono text-sm"
        />
        <button
          type="button"
          onClick={lookup}
          disabled={loading || !doi.trim()}
          className="btn-primary text-sm whitespace-nowrap flex items-center gap-2 flex-shrink-0"
        >
          {loading
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Fetching…</>
            : '🔍 Fetch'
          }
        </button>
      </div>

      {/* Show what was filled after a successful fetch */}
      {result && (
        <div className="mt-3 bg-white dark:bg-gray-800 rounded-lg p-3 border border-blue-100 dark:border-blue-800 text-xs space-y-1">
          <p className="font-semibold text-gray-700 dark:text-gray-300">Filled from CrossRef:</p>
          {result.title?.[0] && <p className="text-gray-600 dark:text-gray-400">📄 <strong>Title:</strong> {result.title[0].slice(0, 80)}…</p>}
          {result.author?.length && (
            <p className="text-gray-600 dark:text-gray-400">
              👥 <strong>Authors:</strong> {result.author.length} author(s) found
              {result.author.some(a => a.affiliation?.length)
                ? ' (with affiliations)'
                : ' — affiliations not in CrossRef, set to PDEU for your entry'
              }
            </p>
          )}
          {result['container-title']?.[0] && <p className="text-gray-600 dark:text-gray-400">📰 <strong>Journal:</strong> {result['container-title'][0]}</p>}
          <p className="text-blue-500 dark:text-blue-400 pt-1">✏️ Review and complete any missing fields below.</p>
        </div>
      )}
    </div>
  )
}

// ── Map CrossRef work object → tab5 field keys ────────────────
function buildFields(w, facultyName) {
  const fields = {}

  // Title
  if (w.title?.[0]) fields.title = w.title[0]

  // Type
  const typeMap = {
    'journal-article':     'Journal Paper',
    'proceedings-article': 'Conference Paper',
    'book-chapter':        'Book Chapter',
    'book':                'Book',
    'posted-content':      'Preprint',
  }
  if (typeMap[w.type]) fields.pub_type = typeMap[w.type]

  // Status
  fields.status = 'Published'

  // Authors: build semicolon-separated name list
  if (w.author?.length) {
    const names = w.author.map(a => [a.given, a.family].filter(Boolean).join(' '))
    fields.coauthors = names.join('; ')

    // Find the submitting faculty's position in the author list (1-indexed)
    if (facultyName) {
      const lastName = facultyName.split(' ').pop()?.toLowerCase()
      const idx = w.author.findIndex(a =>
        a.family?.toLowerCase() === lastName ||
        [a.given, a.family].join(' ').toLowerCase().includes(lastName || '')
      )
      if (idx >= 0) fields.author_number = String(idx + 1)
    }

    // Affiliations — CrossRef often omits them
    // Build list: use CrossRef data where available, fall back to PDEU for the faculty's position
    const authorNumber = parseInt(fields.author_number, 10)
    const affils = w.author.map((a, i) => {
      if (a.affiliation?.[0]?.name) return a.affiliation[0].name
      // For the submitting faculty's slot, use PDEU
      if (!isNaN(authorNumber) && i === authorNumber - 1) return PDEU_AFFIL
      return ''   // unknown — leave blank for faculty to fill
    })
    const nonEmpty = affils.filter(Boolean)
    if (nonEmpty.length) {
      fields.coauthor_affiliations = affils.join('; ')
    }
  }

  // Journal / conference / book
  if (w['container-title']?.[0]) fields.journal_or_conf_name = w['container-title'][0]

  // Publisher
  if (w.publisher) fields.publisher_name = w.publisher

  // Volume, issue, pages
  if (w.volume) fields.volume_no   = w.volume
  if (w.issue)  fields.issue_no    = w.issue
  if (w.page)   fields.page_nos    = w.page

  // DOI
  if (w.DOI)  fields.doi = w.DOI
  if (w.URL)  fields.website_link = w.URL

  // Peer reviewed (CrossRef marks journals as peer-reviewed via type)
  if (w.type === 'journal-article') fields.peer_reviewed = 'Yes'

  // Subscription type hint from ISSN
  if (w.ISSN?.length) fields.subscription_type = 'Subscription'

  // Open access
  if (w.license?.some(l => l.URL?.includes('creativecommons')))
    fields.subscription_type = 'Open Access'

  // Date and academic year
  const parts = w.published?.['date-parts']?.[0] ||
                w['published-print']?.['date-parts']?.[0] ||
                w['published-online']?.['date-parts']?.[0]
  if (parts) {
    const [y, m = 1, d = 1] = parts
    fields.pub_date     = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    // Academic year: Jan–May → current-previous, Jun–Dec → current-next
    fields.academic_year = m >= 6
      ? `${y}-${String(y + 1).slice(-2)}`
      : `${y - 1}-${String(y).slice(-2)}`
  }

  return fields
}
