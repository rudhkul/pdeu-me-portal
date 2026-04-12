import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getAllFaculties, listDir } from '../../lib/github'
import { TABS, ADMIN_TAB_MAP, ADMINS } from '../../config/tabs'

export default function AdminDashboard() {
  const { session }   = useAuth()
  const [counts,    setCounts]    = useState({})
  const [faculties, setFaculties] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [activeAdmin, setActiveAdmin] = useState('All')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)

    // Count files (= faculties who have submitted) per tab directory
    const countResults = {}
    await Promise.all(
      TABS.map(async tab => {
        const files = await listDir(`records/${tab.id}`)
        const jsonFiles = files.filter(f => f.name.endsWith('.json'))
        countResults[tab.id] = jsonFiles.length   // number of faculties with data
      })
    )
    setCounts(countResults)

    const fList = await getAllFaculties()
    setFaculties(fList)
    setLoading(false)
  }

  const visibleTabs = TABS.filter(t => activeAdmin === 'All' || ADMIN_TAB_MAP[t.id] === activeAdmin)
  const totalFacultiesWithData = new Set(Object.values(counts)).size

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-pdeu-blue">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Logged in as <strong>{session?.fullName}</strong></p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Registered Faculty', value: faculties.length, icon: '👥', color: 'bg-green-50 text-green-700' },
          { label: 'Total Tabs', value: TABS.length, icon: '📋', color: 'bg-blue-50 text-blue-700' },
          { label: 'Admins', value: ADMINS.length, icon: '🛡️', color: 'bg-purple-50 text-purple-700' },
          { label: 'Tabs with Data', value: Object.values(counts).filter(v => v > 0).length, icon: '✅', color: 'bg-orange-50 text-orange-700' },
        ].map(stat => (
          <div key={stat.label} className="card flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${stat.color}`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{loading ? '…' : stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Admin filter */}
      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <span className="text-sm text-gray-500">Filter by owner:</span>
        {['All', ...ADMINS].map(name => (
          <button
            key={name}
            onClick={() => setActiveAdmin(name)}
            className={`tab-pill ${activeAdmin === name
              ? 'bg-pdeu-blue text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-pdeu-light hover:text-pdeu-blue'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Tabs grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {visibleTabs.map(tab => (
          <Link
            key={tab.id}
            to={`/admin/tab/${tab.id}`}
            className="card hover:shadow-md hover:border-pdeu-blue transition-all group"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{tab.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-800 group-hover:text-pdeu-blue leading-tight">
                  {tab.number}. {tab.name}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Owner: <span className="font-medium text-gray-600">{ADMIN_TAB_MAP[tab.id]}</span>
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-2xl font-bold text-pdeu-blue">
                {loading ? '…' : counts[tab.id] ?? 0}
              </span>
              <span className="text-xs text-gray-400">faculties submitted</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Faculty list */}
      <div className="card">
        <h2 className="font-semibold text-gray-800 mb-4">Registered Faculty ({faculties.length})</h2>
        {loading
          ? <p className="text-gray-400 text-sm">Loading…</p>
          : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {faculties.map(f => (
                <div key={f.id} className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 truncate" title={f.fullName}>
                  {f.fullName}
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}
