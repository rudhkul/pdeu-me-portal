import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getFacultyRecords } from '../../lib/github'
import { TABS } from '../../config/tabs'

export default function FacultyDashboard() {
  const { session }  = useAuth()
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // Fetch record counts for all tabs in parallel
      const entries = await Promise.all(
        TABS.map(async tab => {
          try {
            const records = await getFacultyRecords(tab.id, session.userId)
            return [tab.id, records.length]
          } catch {
            return [tab.id, 0]
          }
        })
      )
      setCounts(Object.fromEntries(entries))
      setLoading(false)
    }
    load()
  }, [])

  const totalEntries = Object.values(counts).reduce((s, v) => s + v, 0)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-pdeu-blue">Welcome, {session?.fullName} 👋</h1>
        <p className="text-gray-500 mt-1">
          {loading ? 'Loading your data…' : `${totalEntries} total entries across all tabs`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {TABS.map(tab => (
          <Link
            key={tab.id}
            to={`/faculty/tab/${tab.id}`}
            className="card hover:shadow-md hover:border-pdeu-blue transition-all group"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl">{tab.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm group-hover:text-pdeu-blue leading-tight">
                  {tab.number}. {tab.name}
                </p>
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">{tab.description}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs bg-pdeu-light text-pdeu-blue px-2 py-0.5 rounded-full font-medium">
                {loading ? '…' : `${counts[tab.id] ?? 0} ${tab.isProfile ? 'record' : 'entries'}`}
              </span>
              <span className="text-pdeu-blue text-xs opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                Open →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
