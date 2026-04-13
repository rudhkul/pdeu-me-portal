import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getAllFaculties, listDir } from '../../lib/github'
import { TABS, ADMIN_TAB_MAP, ADMINS } from '../../config/tabs'

export default function AdminDashboard() {
  const { session }  = useAuth()
  const [counts,     setCounts]     = useState({})
  const [faculties,  setFaculties]  = useState([])
  const [tabMatrix,  setTabMatrix]  = useState({})   // { tabId: Set of userIds who submitted }
  const [loading,    setLoading]    = useState(true)
  const [activeAdmin, setActiveAdmin] = useState('All')
  const [showMatrix,  setShowMatrix]  = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [fList] = await Promise.all([getAllFaculties()])
    setFaculties(fList)

    const countResults = {}
    const matrix       = {}
    await Promise.all(
      TABS.map(async tab => {
        const files = await listDir(`records/${tab.id}`)
        const jsons = files.filter(f => f.name.endsWith('.json'))
        countResults[tab.id] = jsons.length
        matrix[tab.id]       = new Set(jsons.map(f => f.name.replace('.json', '')))
      })
    )
    setCounts(countResults)
    setTabMatrix(matrix)
    setLoading(false)
  }

  const visibleTabs = TABS.filter(t => activeAdmin === 'All' || ADMIN_TAB_MAP[t.id] === activeAdmin)
  const totalSubmissions = Object.values(counts).reduce((s, v) => s + v, 0)
  const tabsWithData = Object.values(counts).filter(v => v > 0).length

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-pdeu-blue">Admin Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Logged in as <strong>{session?.fullName}</strong></p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Registered Faculty', value: faculties.length, icon: '👥', color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
          { label: 'Total Submissions', value: totalSubmissions, icon: '📊', color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
          { label: 'Tabs with Data', value: tabsWithData, icon: '✅', color: 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400' },
          { label: 'Admins', value: ADMINS.length, icon: '🛡️', color: 'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400' },
        ].map(stat => (
          <div key={stat.label} className="card flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${stat.color}`}>{stat.icon}</div>
            <div>
              <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{loading ? '…' : stat.value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Submission analytics matrix */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">Submission Analytics</h2>
            <p className="text-xs text-gray-400 mt-0.5">Which faculty have submitted which tabs</p>
          </div>
          <button onClick={() => setShowMatrix(s => !s)} className="btn-secondary text-sm">
            {showMatrix ? 'Hide Matrix' : 'Show Full Matrix'}
          </button>
        </div>

        {/* Per-tab completion bars */}
        <div className="space-y-2">
          {visibleTabs.slice(0, showMatrix ? visibleTabs.length : 8).map(tab => {
            const submitted = counts[tab.id] || 0
            const total     = faculties.length || 1
            const pct       = Math.round((submitted / total) * 100)
            return (
              <Link to={`/admin/tab/${tab.id}`} key={tab.id} className="flex items-center gap-3 group hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-2 py-1.5 -mx-2">
                <span className="text-base w-6 flex-shrink-0">{tab.icon}</span>
                <span className="text-sm text-gray-600 dark:text-gray-300 w-48 truncate group-hover:text-pdeu-blue">{tab.number}. {tab.name}</span>
                <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-400' : pct >= 50 ? 'bg-pdeu-blue' : 'bg-gray-300'}`}
                    style={{ width: loading ? '0%' : `${pct}%` }} />
                </div>
                <span className="text-xs text-gray-400 w-20 text-right flex-shrink-0">
                  {loading ? '…' : `${submitted} / ${faculties.length} faculty`}
                </span>
              </Link>
            )
          })}
          {!showMatrix && visibleTabs.length > 8 && (
            <button onClick={() => setShowMatrix(true)} className="text-xs text-pdeu-blue hover:underline mt-1">
              + {visibleTabs.length - 8} more tabs…
            </button>
          )}
        </div>

        {/* Full faculty × tab matrix */}
        {showMatrix && faculties.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Faculty × Tab Submission Matrix</p>
            <table className="text-xs w-full">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1 text-gray-500 dark:text-gray-400 font-medium min-w-[160px]">Faculty</th>
                  {TABS.map(t => (
                    <th key={t.id} className="px-1 py-1 text-gray-400 font-medium" title={t.name}>{t.number}</th>
                  ))}
                  <th className="px-2 py-1 text-gray-500 dark:text-gray-400 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {faculties.map(f => {
                  const submittedCount = TABS.filter(t => tabMatrix[t.id]?.has(f.id)).length
                  return (
                    <tr key={f.id} className="border-t border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-2 py-1.5 text-gray-700 dark:text-gray-300 font-medium truncate max-w-[160px]" title={f.fullName}>{f.fullName}</td>
                      {TABS.map(t => {
                        const done = tabMatrix[t.id]?.has(f.id)
                        return (
                          <td key={t.id} className="px-1 py-1.5 text-center">
                            {loading ? <span className="text-gray-200">·</span>
                              : done
                              ? <span className="text-green-500" title="Submitted">✓</span>
                              : <span className="text-gray-200 dark:text-gray-600" title="Not submitted">·</span>
                            }
                          </td>
                        )
                      })}
                      <td className="px-2 py-1.5 text-center">
                        <span className={`font-bold ${submittedCount === TABS.length ? 'text-green-600' : submittedCount >= TABS.length / 2 ? 'text-amber-500' : 'text-gray-400'}`}>
                          {loading ? '…' : `${submittedCount}/${TABS.length}`}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin filter + tab grid */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <span className="text-sm text-gray-500 dark:text-gray-400">Filter by owner:</span>
        {['All', ...ADMINS].map(name => (
          <button key={name} onClick={() => setActiveAdmin(name)}
            className={`tab-pill ${activeAdmin === name ? 'bg-pdeu-blue text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-pdeu-light'}`}>
            {name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visibleTabs.map(tab => (
          <Link key={tab.id} to={`/admin/tab/${tab.id}`}
            className="card hover:shadow-md hover:border-pdeu-blue transition-all group">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{tab.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800 dark:text-gray-100 group-hover:text-pdeu-blue leading-tight">{tab.number}. {tab.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Owner: <span className="font-medium text-gray-600 dark:text-gray-300">{ADMIN_TAB_MAP[tab.id]}</span></p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-2xl font-bold text-pdeu-blue">{loading ? '…' : counts[tab.id] ?? 0}</span>
              <span className="text-xs text-gray-400">faculties submitted</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
