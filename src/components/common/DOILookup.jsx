import { useState } from 'react'
import toast from 'react-hot-toast'

/**
 * DOI Lookup component for the Publications tab.
 * Uses the free CrossRef API (no API key needed).
 * Calls onFill(fields) with the mapped data to auto-fill the form.
 */
export default function DOILookup({ onFill }) {
  const [doi,     setDoi]     = useState('')
  const [loading, setLoading] = useState(false)

  async function lookup() {
    const cleaned = doi.trim()
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, '')  // strip URL prefix if pasted
      .replace(/^doi:/i, '')
      .trim()

    if (!cleaned) { toast.error('Enter a DOI first'); return }

    setLoading(true)
    try {
      const res = await fetch(
        `https://api.crossref.org/works/${encodeURIComponent(cleaned)}`,
        { headers: { 'User-Agent': 'PDEU-ME-Portal/1.0 (mailto:admin@sot.pdpu.ac.in)' } }
      )
      if (!res.ok) throw new Error(res.status === 404 ? 'DOI not found. Check and try again.' : `CrossRef error ${res.status}`)

      const { message: w } = await res.json()

      // ── Map CrossRef fields → our tab5 field keys ─────────
      const fields = {}

      // Title
      if (w.title?.[0])
        fields.title = w.title[0]

      // Authors as semicolon-separated list
      if (w.author?.length) {
        fields.coauthors = w.author.map(a =>
          [a.given, a.family].filter(Boolean).join(' ')
        ).join('; ')

        // Affiliations
        const affils = w.author
          .map(a => a.affiliation?.[0]?.name || '')
          .filter(Boolean)
        if (affils.length)
          fields.coauthor_affiliations = affils.join('; ')
      }

      // Journal / conference name
      if (w['container-title']?.[0])
        fields.journal_or_conf_name = w['container-title'][0]

      // Publisher
      if (w.publisher)
        fields.publisher_name = w.publisher

      // Type
      const typeMap = {
        'journal-article':      'Journal Paper',
        'proceedings-article':  'Conference Paper',
        'book-chapter':         'Book Chapter',
        'book':                 'Book',
        'posted-content':       'Preprint',
      }
      if (w.type && typeMap[w.type])
        fields.pub_type = typeMap[w.type]

      // Volume, issue, pages
      if (w.volume) fields.volume_no = w.volume
      if (w.issue)  fields.issue_no  = w.issue
      if (w.page)   fields.page_nos  = w.page

      // Impact factor — CrossRef doesn't provide IF, skip

      // DOI
      fields.doi = cleaned

      // Publication date
      const dateParts = w.published?.['date-parts']?.[0] ||
                        w['published-print']?.['date-parts']?.[0] ||
                        w['published-online']?.['date-parts']?.[0]
      if (dateParts) {
        const [y, m = 1, d = 1] = dateParts
        fields.pub_date     = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
        fields.academic_year = `${y}-${String(y + 1).slice(-2)}`
      }

      // Status
      fields.status = 'Published'

      // ISSN → subscription type hint
      if (w.ISSN?.length) fields.subscription_type = 'Subscription'

      // URL
      if (w.URL) fields.website_link = w.URL

      onFill(fields)

      const filled = Object.keys(fields).length
      toast.success(`Auto-filled ${filled} fields from CrossRef!`)
    } catch (e) {
      toast.error(e.message || 'Lookup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-2">
        🔍 Auto-fill from DOI
      </p>
      <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
        Paste your DOI and click Fetch — title, authors, journal, volume, pages and more will be filled automatically via CrossRef.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={doi}
          onChange={e => setDoi(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && lookup()}
          placeholder="e.g. 10.1016/j.energy.2024.123456  or paste the full DOI URL"
          className="form-input flex-1 font-mono text-sm"
        />
        <button
          type="button"
          onClick={lookup}
          disabled={loading || !doi.trim()}
          className="btn-primary text-sm whitespace-nowrap flex items-center gap-2 flex-shrink-0"
        >
          {loading
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Fetching…</>
            : '🔍 Fetch'
          }
        </button>
      </div>
      <p className="text-xs text-blue-500 dark:text-blue-500 mt-2">
        Works for journal papers, conference papers, and book chapters. Powered by CrossRef (free, no account needed).
        Fill in any missing fields manually after fetching.
      </p>
    </div>
  )
}
