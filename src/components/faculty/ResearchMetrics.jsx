import { useEffect, useState } from 'react'
import { getFacultyRecords } from '../../lib/github'

const WORKER = import.meta.env.VITE_WORKER_URL

export default function ResearchMetrics({ session, localPubs = [] }) {
  const [scholarData, setScholarData] = useState(null)
  const [localData,   setLocalData]   = useState(null)
  const [scholarId,   setScholarId]   = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setLocalData(computeLocal(localPubs))

    try {
      const tab1    = await getFacultyRecords('tab1', session.userId)
      const profile = tab1?.[0] || {}
      const sid     = (profile.google_scholar_id || '').trim()

      if (!sid) { setLoading(false); return }
      setScholarId(sid)

      // Fetch via Cloudflare Worker (server-side — bypasses CORS & Scholar bot blocks)
      const res  = await fetch(`${WORKER}/api/scholar/${encodeURIComponent(sid)}`)
      const data = await res.json()

      if (data.error) {
        setError(`Scholar: ${data.error}`)
      } else if (data.citations === null && data.hIndex === null) {
        setError('Scholar profile found but no metrics yet. Your profile may be too new.')
      } else {
        setScholarData(data)
      }
    } catch (e) {
      setError('Could not reach Scholar. Showing local data only.')
    }
    setLoading(false)
  }

  function computeLocal(pubs) {
    const published   = pubs.filter(p => ['Published','Accepted'].includes(p.status))
    const journals    = published.filter(p => p.pub_type === 'Journal Paper')
    const confs       = published.filter(p => p.pub_type === 'Conference Paper')
    const withIF      = journals.filter(p => p.impact_factor && parseFloat(p.impact_factor) > 0)
    const avgIF       = withIF.length
      ? (withIF.reduce((s,p) => s + parseFloat(p.impact_factor), 0) / withIF.length).toFixed(2)
      : null
    return {
      total:       published.length,
      journals:    journals.length,
      confs:       confs.length,
      avgIF,
      openAccess:  published.filter(p => p.subscription_type === 'Open Access').length,
      withStudent: published.filter(p =>
        p.btech_coauthor === 'Yes' || p.mtech_coauthor === 'Yes' || p.phd_coauthor === 'Yes'
      ).length,
    }
  }

  if (loading) return (
    <div className="card mb-6">
      <div className="flex items-center gap-3 text-gray-400 dark:text-gray-500">
        <div className="w-4 h-4 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin flex-shrink-0"/>
        <span className="text-sm">Loading research metrics…</span>
      </div>
    </div>
  )

  const L = localData

  return (
    <div className="card mb-6">
      <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">📊 Research Metrics</h2>

      {/* ── Google Scholar metrics ── */}
      {scholarData ? (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <img src="https://scholar.google.com/favicon.ico" alt="Scholar" className="w-4 h-4" />
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Google Scholar — {scholarData.name}
              </p>
            </div>
            <a href={scholarData.profileUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-pdeu-blue dark:text-blue-400 hover:underline">
              View profile ↗
            </a>
          </div>

          {/* Main metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            {[
              { icon: '📈', val: scholarData.citations,  sub: scholarData.citationsSince != null ? `${scholarData.citationsSince} since 2019` : null, lbl: 'Total Citations',   color: 'text-blue-600 dark:text-blue-400' },
              { icon: '🎯', val: scholarData.hIndex,     sub: scholarData.hIndexSince    != null ? `${scholarData.hIndexSince} since 2019`    : null, lbl: 'h-index',           color: 'text-purple-600 dark:text-purple-400' },
              { icon: '📊', val: scholarData.i10Index,   sub: scholarData.i10Since       != null ? `${scholarData.i10Since} since 2019`       : null, lbl: 'i10-index',         color: 'text-green-600 dark:text-green-400' },
              { icon: '📄', val: scholarData.publications, sub: null,                                                                                  lbl: 'Works listed',      color: 'text-amber-600 dark:text-amber-400' },
            ].map(m => (
              <div key={m.lbl}
                className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 text-center">
                <p className="text-xl mb-1">{m.icon}</p>
                <p className={`text-2xl font-bold ${m.color}`}>{m.val ?? '—'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-tight">{m.lbl}</p>
                {m.sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{m.sub}</p>}
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">
            Data fetched live from Google Scholar via Cloudflare proxy ·
            Scholar ID: <span className="font-mono">{scholarId}</span> ·
            {scholarData.fetchedAt && ` Fetched: ${new Date(scholarData.fetchedAt).toLocaleTimeString('en-IN')}`}
          </p>
        </div>
      ) : (
        <div className={`rounded-xl px-4 py-3 mb-5 text-sm border ${
          error
            ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400'
            : 'bg-gray-50 dark:bg-gray-700/50 border-gray-100 dark:border-gray-700 text-gray-500 dark:text-gray-400'
        }`}>
          {error
            ? <><span className="font-semibold">⚠️ </span>{error}</>
            : <>
                ℹ️ Add your <strong>Google Scholar ID</strong> in <strong>Tab 1 → Faculty Information</strong> to pull live citation metrics.
                <br/>
                <span className="text-xs mt-1 block">
                  Your Scholar ID is the code after <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">user=</code> in your Scholar profile URL.
                  e.g. <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">scholar.google.com/citations?user=<strong>ABC123xyz</strong></code>
                </span>
              </>
          }
        </div>
      )}

      {/* ── Local tab5 metrics (always shown) ── */}
      {L && L.total > 0 && (
        <>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
            From your Tab 5 entries
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { val: L.total,        lbl: 'Total Publications',   icon: '📄' },
              { val: L.journals,     lbl: 'Journal Papers',       icon: '📰' },
              { val: L.confs,        lbl: 'Conference Papers',    icon: '🎤' },
              { val: L.avgIF ?? '—', lbl: 'Avg Impact Factor',   icon: '⭐' },
              { val: L.openAccess,   lbl: 'Open Access',          icon: '🔓' },
              { val: L.withStudent,  lbl: 'With Student Authors', icon: '🎓' },
            ].map(m => (
              <div key={m.lbl}
                className="bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 rounded-xl p-3 text-center">
                <p className="text-base mb-0.5">{m.icon}</p>
                <p className="text-xl font-bold text-gray-700 dark:text-gray-200">{m.val}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{m.lbl}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
