import { useEffect, useState } from 'react'
import { getFacultyRecords } from '../../lib/github'

const WORKER = import.meta.env.VITE_WORKER_URL

export default function ResearchMetrics({ session, localPubs = [] }) {
  const [scholarData,  setScholarData]  = useState(null)
  const [localData,    setLocalData]    = useState(null)
  const [scholarId,    setScholarId]    = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [status,       setStatus]       = useState('idle') // idle | ok | blocked | notfound | error
  const [errorMsg,     setErrorMsg]     = useState('')

  // Manual override state (when Scholar is blocked)
  const [manual,       setManual]       = useState({ citations: '', hIndex: '', i10: '' })
  const [showManual,   setShowManual]   = useState(false)

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
      await fetchScholar(sid)
    } catch { setStatus('error'); setErrorMsg('Could not load profile.') }
    setLoading(false)
  }

  async function fetchScholar(sid) {
    try {
      const res  = await fetch(`${WORKER}/api/scholar/${encodeURIComponent(sid)}`)
      const data = await res.json()

      if (res.status === 429 || data.error === 'blocked') {
        setStatus('blocked')
        setShowManual(true)
        return
      }
      if (res.status === 404 || data.error === 'notfound') {
        setStatus('notfound')
        setErrorMsg('No Scholar profile found for ID: ' + sid)
        return
      }
      if (data.error) {
        setStatus('error')
        setErrorMsg(data.error)
        return
      }
      setScholarData(data)
      setStatus('ok')
    } catch {
      setStatus('blocked')
      setShowManual(true)
    }
  }

  function computeLocal(pubs) {
    const published  = pubs.filter(p => ['Published','Accepted'].includes(p.status))
    const journals   = published.filter(p => p.pub_type === 'Journal Paper')
    const confs      = published.filter(p => p.pub_type === 'Conference Paper')
    const withIF     = journals.filter(p => p.impact_factor && parseFloat(p.impact_factor) > 0)
    const avgIF      = withIF.length
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

  // Displayed Scholar metrics — either live or manual
  const display = scholarData || (
    (manual.citations || manual.hIndex || manual.i10) ? {
      citations:  parseInt(manual.citations) || null,
      hIndex:     parseInt(manual.hIndex)    || null,
      i10Index:   parseInt(manual.i10)       || null,
      name:       session.fullName,
      profileUrl: scholarId ? `https://scholar.google.com/citations?user=${scholarId}` : null,
    } : null
  )

  return (
    <div className="card mb-6">
      <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">📊 Research Metrics</h2>

      {/* ── Live Google Scholar metrics ── */}
      {display && (
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🎓</span>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Google Scholar {status === 'ok' ? '— Live' : '— Manual input'}
                {display.name ? ` · ${display.name}` : ''}
              </p>
            </div>
            {display.profileUrl && (
              <a href={display.profileUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-pdeu-blue dark:text-blue-400 hover:underline">
                View profile ↗
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            {[
              { icon: '📈', val: display.citations,     sub: display.citationsSince != null ? `${display.citationsSince} since 2019` : null, lbl: 'Total Citations',  color: 'text-blue-600 dark:text-blue-400' },
              { icon: '🎯', val: display.hIndex,        sub: display.hIndexSince    != null ? `${display.hIndexSince} since 2019`    : null, lbl: 'h-index',          color: 'text-purple-600 dark:text-purple-400' },
              { icon: '📊', val: display.i10Index,      sub: display.i10Since       != null ? `${display.i10Since} since 2019`       : null, lbl: 'i10-index',        color: 'text-green-600 dark:text-green-400' },
              { icon: '📄', val: display.publications,  sub: null,                                                                           lbl: 'Works listed',     color: 'text-amber-600 dark:text-amber-400' },
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

          {status === 'ok' && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Live from Google Scholar via Cloudflare proxy ·
              {display.fetchedAt && ` ${new Date(display.fetchedAt).toLocaleString('en-IN')}`}
            </p>
          )}
        </div>
      )}

      {/* ── Status messages ── */}
      {!scholarId && (
        <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-100 dark:border-gray-700 rounded-xl px-4 py-3 mb-5 text-sm text-gray-500 dark:text-gray-400">
          ℹ️ Add your <strong>Google Scholar ID</strong> in <strong>Tab 1 → Faculty Information</strong> to show live citation metrics.
          <div className="mt-1 text-xs">
            Your Scholar ID is the code after <code className="bg-gray-200 dark:bg-gray-600 px-1 rounded">user=</code> in your profile URL:<br/>
            <code className="text-pdeu-blue dark:text-blue-400">scholar.google.com/citations?user=<strong>WoYtYLwAAAAJ</strong></code>
          </div>
        </div>
      )}

      {status === 'notfound' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl px-4 py-3 mb-5 text-sm text-red-600 dark:text-red-400">
          ❌ {errorMsg}
        </div>
      )}

      {/* ── Blocked: manual input fallback ── */}
      {status === 'blocked' && (
        <div className="mb-5">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 mb-3 text-sm text-amber-700 dark:text-amber-400">
            ⚠️ Google Scholar is rate-limiting automated requests right now (they do this periodically).
            Enter your metrics manually from your{' '}
            <a href={`https://scholar.google.com/citations?user=${scholarId}`}
              target="_blank" rel="noopener noreferrer"
              className="underline font-medium">Scholar profile ↗</a>
            {' '}and they'll show on your profile.
            <button onClick={() => fetchScholar(scholarId)}
              className="ml-3 text-xs underline">Try again</button>
          </div>

          {showManual && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'citations', label: 'Total Citations', placeholder: 'e.g. 234' },
                { key: 'hIndex',    label: 'h-index',         placeholder: 'e.g. 8'   },
                { key: 'i10',       label: 'i10-index',       placeholder: 'e.g. 12'  },
              ].map(f => (
                <div key={f.key}>
                  <label className="form-label">{f.label}</label>
                  <input
                    type="number"
                    className="form-input"
                    placeholder={f.placeholder}
                    value={manual[f.key]}
                    onChange={e => setManual(p => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Local tab5 metrics (always) ── */}
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
