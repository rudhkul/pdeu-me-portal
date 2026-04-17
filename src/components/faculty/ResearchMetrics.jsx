import { useEffect, useState } from 'react'
import { getFacultyRecords } from '../../lib/github'

/**
 * Fetches research metrics from OpenAlex (free, no API key)
 * Falls back to computing metrics from local tab5 data.
 */
export default function ResearchMetrics({ session, localPubs = [] }) {
  const [metrics, setMetrics]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [source,  setSource]    = useState('local')  // 'openalex' | 'local'

  useEffect(() => { fetchMetrics() }, [])

  async function fetchMetrics() {
    setLoading(true)

    // Try OpenAlex first (using ORCID or name search)
    // Profile data is in tab1
    try {
      const tab1 = await getFacultyRecords('tab1', session.userId)
      const profile = tab1?.[0] || {}
      const orcid   = profile.orcid?.trim()
      const name    = session.fullName

      let authorData = null

      // 1. Try ORCID lookup (most accurate)
      if (orcid) {
        const orcidFormatted = orcid.includes('-') ? orcid : orcid.replace(/(.{4})(?=.)/g, '$1-')
        const res = await fetch(
          `https://api.openalex.org/authors/orcid:${orcidFormatted}`,
          { headers: { 'User-Agent': 'PDEU-ME-Portal/1.0 (mailto:admin@pdeu.ac.in)' } }
        )
        if (res.ok) authorData = await res.json()
      }

      // 2. Fallback: name search
      if (!authorData && name) {
        const encoded = encodeURIComponent(name)
        const res = await fetch(
          `https://api.openalex.org/authors?search=${encoded}&filter=affiliations.institution.country_code:IN&per_page=1`,
          { headers: { 'User-Agent': 'PDEU-ME-Portal/1.0' } }
        )
        if (res.ok) {
          const data = await res.json()
          if (data.results?.length > 0) authorData = data.results[0]
        }
      }

      if (authorData) {
        const s = authorData.summary_stats || {}
        setMetrics({
          hIndex:       s.h_index          ?? 0,
          i10Index:     s.i10_index        ?? 0,
          citations:    authorData.cited_by_count ?? 0,
          publications: authorData.works_count    ?? 0,
          meanCitedness: s['2yr_mean_citedness'] != null
            ? s['2yr_mean_citedness'].toFixed(2) : null,
          openAlexUrl: authorData.id,
        })
        setSource('openalex')
        setLoading(false)
        return
      }
    } catch (_) { /* fall through to local */ }

    // Fallback: compute from local tab5 publications
    computeLocalMetrics()
  }

  function computeLocalMetrics() {
    const published = localPubs.filter(p => p.status === 'Published' || p.status === 'Accepted')
    const journals  = published.filter(p => p.pub_type === 'Journal Paper')
    const conferences = published.filter(p => p.pub_type === 'Conference Paper')

    // Rough h-index from impact factors as a proxy (no citation counts locally)
    setMetrics({
      publications: published.length,
      journals:     journals.length,
      conferences:  conferences.length,
      avgImpactFactor: journals.length
        ? (journals.reduce((s, p) => s + (parseFloat(p.impact_factor) || 0), 0) / journals.filter(p => p.impact_factor).length || 0).toFixed(2)
        : null,
      openAccess: published.filter(p => p.subscription_type === 'Open Access').length,
    })
    setSource('local')
    setLoading(false)
  }

  if (loading) return (
    <div className="card mb-6">
      <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
        <div className="w-5 h-5 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Fetching research metrics…</span>
      </div>
    </div>
  )

  if (!metrics) return null

  const cards = source === 'openalex'
    ? [
        { label: 'Citations',     value: metrics.citations,    icon: '📈', color: 'text-blue-600 dark:text-blue-400' },
        { label: 'h-index',       value: metrics.hIndex,       icon: '🎯', color: 'text-purple-600 dark:text-purple-400' },
        { label: 'i10-index',     value: metrics.i10Index,     icon: '📊', color: 'text-green-600 dark:text-green-400' },
        { label: 'Publications',  value: metrics.publications, icon: '📄', color: 'text-amber-600 dark:text-amber-400' },
        ...(metrics.meanCitedness != null ? [{ label: '2yr Citation Avg', value: metrics.meanCitedness, icon: '⭐', color: 'text-teal-600 dark:text-teal-400' }] : []),
      ]
    : [
        { label: 'Publications',      value: metrics.publications,     icon: '📄', color: 'text-blue-600 dark:text-blue-400' },
        { label: 'Journal Papers',    value: metrics.journals,         icon: '📰', color: 'text-purple-600 dark:text-purple-400' },
        { label: 'Conference Papers', value: metrics.conferences,      icon: '🎤', color: 'text-green-600 dark:text-green-400' },
        ...(metrics.avgImpactFactor ? [{ label: 'Avg Impact Factor', value: metrics.avgImpactFactor, icon: '⭐', color: 'text-amber-600 dark:text-amber-400' }] : []),
        { label: 'Open Access',       value: metrics.openAccess,       icon: '🔓', color: 'text-teal-600 dark:text-teal-400' },
      ]

  return (
    <div className="card mb-6 print:shadow-none print:border print:border-gray-200">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          📊 Research Metrics
        </h2>
        <div className="flex items-center gap-2">
          {source === 'openalex' ? (
            <a href={metrics.openAlexUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-pdeu-blue dark:text-blue-400 hover:underline flex items-center gap-1">
              Source: OpenAlex ↗
            </a>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              Source: Local data · Add ORCID in Profile tab for live metrics
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map(c => (
          <div key={c.label}
            className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 text-center border border-gray-100 dark:border-gray-700">
            <p className="text-2xl mb-1">{c.icon}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value ?? '—'}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-tight">{c.label}</p>
          </div>
        ))}
      </div>

      {source === 'openalex' && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          Live data from OpenAlex. Updates daily. Add your ORCID in Tab 1 for accurate attribution.
        </p>
      )}
    </div>
  )
}
