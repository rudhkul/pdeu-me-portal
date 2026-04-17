import { useEffect, useState } from 'react'
import { getFacultyRecords } from '../../lib/github'

/**
 * Research Metrics
 * - h-index, citations, i10-index: entered manually in Tab 1
 * - Publication stats: computed from Tab 5 entries
 */
export default function ResearchMetrics({ session, localPubs = [] }) {
  const [profile, setProfile] = useState(null)
  const [local,   setLocal]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const tab1 = await getFacultyRecords('tab1', session.userId)
        setProfile(tab1?.[0] || {})
      } catch { setProfile({}) }
      setLocal(computeLocal(localPubs))
      setLoading(false)
    }
    load()
  }, [])

  function computeLocal(pubs) {
    const pub    = pubs.filter(p => ['Published', 'Accepted'].includes(p.status))
    const jnls   = pub.filter(p => p.pub_type === 'Journal Paper')
    const confs  = pub.filter(p => p.pub_type === 'Conference Paper')
    const books  = pub.filter(p => p.pub_type === 'Book Chapter' || p.pub_type === 'Book')
    const withIF = jnls.filter(p => parseFloat(p.impact_factor) > 0)
    const avgIF  = withIF.length
      ? (withIF.reduce((s, p) => s + parseFloat(p.impact_factor), 0) / withIF.length).toFixed(2)
      : null
    return {
      total:       pub.length,
      journals:    jnls.length,
      confs:       confs.length,
      books:       books.length,
      avgIF,
      openAccess:  pub.filter(p => p.subscription_type === 'Open Access').length,
      withStudent: pub.filter(p =>
        p.btech_coauthor === 'Yes' || p.mtech_coauthor === 'Yes' || p.phd_coauthor === 'Yes'
      ).length,
      underReview: localPubs.filter(p => p.status === 'Under Review').length,
    }
  }

  if (loading) return (
    <div className="card mb-6">
      <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm">
        <div className="w-4 h-4 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin"/>
        Loading research metrics…
      </div>
    </div>
  )

  const hasCitation = profile?.citations_count || profile?.h_index || profile?.i10_index
  const L = local

  return (
    <div className="card mb-6">
      <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">📊 Research Metrics</h2>

      {/* ── Citation indices (from Tab 1) ── */}
      {hasCitation ? (
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Citation Indices
            <span className="ml-2 font-normal normal-case text-gray-400 dark:text-gray-500">
              — update anytime in Tab 1
            </span>
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: '📈', val: profile.citations_count, lbl: 'Total Citations',  color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' },
              { icon: '🎯', val: profile.h_index,         lbl: 'h-index',          color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800' },
              { icon: '📊', val: profile.i10_index,       lbl: 'i10-index',        color: 'text-green-600 dark:text-green-400',  bg: 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' },
            ].map(m => (
              <div key={m.lbl} className={`border rounded-xl p-5 text-center ${m.bg}`}>
                <p className="text-2xl mb-1">{m.icon}</p>
                <p className={`text-3xl font-bold ${m.color}`}>{m.val ?? '—'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{m.lbl}</p>
              </div>
            ))}
          </div>
          {profile.google_scholar_id && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Scholar:{' '}
              <a
                href={`https://scholar.google.com/citations?user=${profile.google_scholar_id}`}
                target="_blank" rel="noopener noreferrer"
                className="text-pdeu-blue dark:text-blue-400 hover:underline font-mono"
              >
                {profile.google_scholar_id} ↗
              </a>
            </p>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 mb-5 text-sm text-gray-500 dark:text-gray-400">
          ℹ️ Fill in your <strong>Citations, h-index, and i10-index</strong> in{' '}
          <strong>Tab 1 → Faculty Information</strong> to display them here.
          Check your{' '}
          <a href="https://scholar.google.com" target="_blank" rel="noopener noreferrer"
            className="text-pdeu-blue dark:text-blue-400 underline">Google Scholar</a>{' '}or{' '}
          <a href="https://www.scopus.com" target="_blank" rel="noopener noreferrer"
            className="text-pdeu-blue dark:text-blue-400 underline">Scopus</a>{' '}profile for the values.
        </div>
      )}

      {/* ── Publication stats (from Tab 5) ── */}
      {L && (
        <>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Publication Breakdown
            <span className="ml-2 font-normal normal-case text-gray-400 dark:text-gray-500">
              — from Tab 5 entries ({L.total} published)
            </span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { val: L.journals,    lbl: 'Journal Papers',     icon: '📰', color: 'text-blue-600 dark:text-blue-400' },
              { val: L.confs,       lbl: 'Conference Papers',  icon: '🎤', color: 'text-purple-600 dark:text-purple-400' },
              { val: L.books,       lbl: 'Books / Chapters',   icon: '📚', color: 'text-amber-600 dark:text-amber-400' },
              { val: L.underReview, lbl: 'Under Review',       icon: '⏳', color: 'text-gray-500 dark:text-gray-400' },
            ].map(m => (
              <div key={m.lbl}
                className="bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-center">
                <p className="text-base mb-0.5">{m.icon}</p>
                <p className={`text-xl font-bold ${m.color}`}>{m.val}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{m.lbl}</p>
              </div>
            ))}
          </div>

          {/* Secondary stats */}
          <div className="flex flex-wrap gap-2 mt-3">
            {L.avgIF && (
              <span className="text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full">
                ⭐ Avg Impact Factor: <strong>{L.avgIF}</strong>
              </span>
            )}
            {L.openAccess > 0 && (
              <span className="text-xs bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full">
                🔓 Open Access: <strong>{L.openAccess}</strong>
              </span>
            )}
            {L.withStudent > 0 && (
              <span className="text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-full">
                🎓 With Student Co-authors: <strong>{L.withStudent}</strong>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
