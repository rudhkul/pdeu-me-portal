import { useEffect, useState } from 'react'
import { getFacultyRecords } from '../../lib/github'

/**
 * Research Metrics
 *
 * Source priority:
 *  1. OpenAlex via ORCID         — only if faculty has set their ORCID in Tab 1
 *                                   ORCID is a unique global identifier → no false matches
 *  2. Local Tab 5 data           — always computed as a cross-check / fallback
 *
 * Name-based search is intentionally NOT used — it returns wrong authors.
 */
export default function ResearchMetrics({ session, localPubs = [] }) {
  const [orcidMetrics, setOrcidMetrics] = useState(null)   // from OpenAlex
  const [localMetrics, setLocalMetrics] = useState(null)   // from tab5
  const [orcid,        setOrcid]        = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [orcidError,   setOrcidError]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)

    // 1. Compute local metrics immediately (always available)
    setLocalMetrics(computeLocal(localPubs))

    // 2. Read ORCID from Tab 1
    try {
      const tab1    = await getFacultyRecords('tab1', session.userId)
      const profile = tab1?.[0] || {}
      const raw     = (profile.orcid || '').trim().replace(/\s/g, '')

      if (!raw) {
        setLoading(false)
        return
      }

      // Normalise: accept with or without dashes, or full URL
      const digits = raw.replace(/[^0-9X]/gi, '')
      if (digits.length !== 16) {
        setOrcidError('ORCID in Tab 1 looks incorrect (should be 16 characters). Update Tab 1 to get live metrics.')
        setLoading(false)
        return
      }
      const formatted = `${digits.slice(0,4)}-${digits.slice(4,8)}-${digits.slice(8,12)}-${digits.slice(12)}`
      setOrcid(formatted)

      // 3. Fetch from OpenAlex by ORCID (exact match — no ambiguity)
      const res = await fetch(
        `https://api.openalex.org/authors/orcid:${formatted}`,
        { headers: { 'User-Agent': 'PDEU-ME-Portal/1.0 (mailto:anirudh.kulkarni@sot.pdpu.ac.in)' } }
      )

      if (res.status === 404) {
        setOrcidError('Your ORCID was not found on OpenAlex. Make sure your papers are linked to your ORCID at orcid.org.')
        setLoading(false)
        return
      }
      if (!res.ok) {
        setOrcidError('OpenAlex is temporarily unavailable. Showing local metrics.')
        setLoading(false)
        return
      }

      const data = await res.json()

      // Sanity check: confirm the name roughly matches to catch mis-typed ORCIDs
      const openAlexName  = (data.display_name || '').toLowerCase()
      const sessionLast   = session.fullName.split(' ').pop().toLowerCase()
      if (openAlexName && sessionLast.length > 2 && !openAlexName.includes(sessionLast)) {
        setOrcidError(
          `OpenAlex returned a different author ("${data.display_name}") for this ORCID. Please verify your ORCID in Tab 1.`
        )
        setLoading(false)
        return
      }

      const s = data.summary_stats || {}
      setOrcidMetrics({
        hIndex:        s.h_index ?? 0,
        i10Index:      s.i10_index ?? 0,
        citations:     data.cited_by_count ?? 0,
        publications:  data.works_count ?? 0,
        mean2yr:       s['2yr_mean_citedness'] != null
          ? parseFloat(s['2yr_mean_citedness']).toFixed(2) : null,
        openAlexUrl:   data.id?.replace('https://openalex.org/', 'https://openalex.org/'),
        displayName:   data.display_name,
        lastUpdated:   data.updated_date,
      })
    } catch (e) {
      setOrcidError('Could not reach OpenAlex. Showing local metrics only.')
    }

    setLoading(false)
  }

  function computeLocal(pubs) {
    const published   = pubs.filter(p => ['Published','Accepted'].includes(p.status))
    const journals    = published.filter(p => p.pub_type === 'Journal Paper')
    const confs       = published.filter(p => p.pub_type === 'Conference Paper')
    const withIF      = journals.filter(p => p.impact_factor && parseFloat(p.impact_factor) > 0)
    const avgIF       = withIF.length
      ? (withIF.reduce((s, p) => s + parseFloat(p.impact_factor), 0) / withIF.length).toFixed(2)
      : null
    const openAccess  = published.filter(p => p.subscription_type === 'Open Access').length
    const withStudent = published.filter(p => p.btech_coauthor === 'Yes' || p.mtech_coauthor === 'Yes' || p.phd_coauthor === 'Yes').length

    return { total: published.length, journals: journals.length, confs: confs.length, avgIF, openAccess, withStudent }
  }

  if (loading) return (
    <div className="card mb-6">
      <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
        <div className="w-4 h-4 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin flex-shrink-0"/>
        <span className="text-sm">Loading research metrics…</span>
      </div>
    </div>
  )

  const L = localMetrics

  return (
    <div className="card mb-6 print:shadow-none print:border print:border-gray-200">
      <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">📊 Research Metrics</h2>

      {/* ── OpenAlex metrics (only when ORCID is verified) ── */}
      {orcidMetrics && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Live — via OpenAlex (ORCID verified)
            </p>
            <a href={orcidMetrics.openAlexUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-pdeu-blue dark:text-blue-400 hover:underline">
              View on OpenAlex ↗
            </a>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { icon: '📈', val: orcidMetrics.citations,    lbl: 'Total Citations',     color: 'text-blue-600 dark:text-blue-400' },
              { icon: '🎯', val: orcidMetrics.hIndex,       lbl: 'h-index',             color: 'text-purple-600 dark:text-purple-400' },
              { icon: '📊', val: orcidMetrics.i10Index,     lbl: 'i10-index',           color: 'text-green-600 dark:text-green-400' },
              { icon: '📄', val: orcidMetrics.publications, lbl: 'Works on OpenAlex',   color: 'text-amber-600 dark:text-amber-400' },
              ...(orcidMetrics.mean2yr != null
                ? [{ icon: '⭐', val: orcidMetrics.mean2yr, lbl: '2yr Mean Citedness', color: 'text-teal-600 dark:text-teal-400' }]
                : []),
            ].map(m => (
              <div key={m.lbl}
                className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 text-center">
                <p className="text-xl mb-1">{m.icon}</p>
                <p className={`text-2xl font-bold ${m.color}`}>{m.val}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-tight">{m.lbl}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Data for <strong className="text-gray-600 dark:text-gray-300">{orcidMetrics.displayName}</strong>
            {' · '}ORCID: {orcid}
            {orcidMetrics.lastUpdated && ` · Updated ${new Date(orcidMetrics.lastUpdated).toLocaleDateString('en-IN')}`}
          </p>
        </div>
      )}

      {/* ORCID error / prompt */}
      {!orcidMetrics && (
        <div className={`rounded-xl px-4 py-3 mb-5 text-sm border ${
          orcidError
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400'
            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400'
        }`}>
          {orcidError
            ? <><span className="font-semibold">⚠️ </span>{orcidError}</>
            : <>ℹ️ Add your <strong>ORCID</strong> in <strong>Tab 1 → Faculty Information</strong> to automatically pull live citation metrics (h-index, i10, total citations) from OpenAlex.</>
          }
        </div>
      )}

      {/* ── Local metrics (always shown) ── */}
      {L && (
        <>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            From your Tab 5 entries
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { val: L.total,       lbl: 'Total Publications',    icon: '📄', color: 'text-gray-700 dark:text-gray-200' },
              { val: L.journals,    lbl: 'Journal Papers',        icon: '📰', color: 'text-gray-700 dark:text-gray-200' },
              { val: L.confs,       lbl: 'Conference Papers',     icon: '🎤', color: 'text-gray-700 dark:text-gray-200' },
              { val: L.avgIF ?? '—',lbl: 'Avg Impact Factor',    icon: '⭐', color: 'text-gray-700 dark:text-gray-200' },
              { val: L.openAccess,  lbl: 'Open Access',           icon: '🔓', color: 'text-gray-700 dark:text-gray-200' },
              { val: L.withStudent, lbl: 'With Student Authors',  icon: '🎓', color: 'text-gray-700 dark:text-gray-200' },
            ].map(m => (
              <div key={m.lbl}
                className="bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-center">
                <p className="text-base mb-0.5">{m.icon}</p>
                <p className={`text-xl font-bold ${m.color}`}>{m.val}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{m.lbl}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
