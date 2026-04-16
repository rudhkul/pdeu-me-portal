import { useEffect, useState } from 'react'
import { TABS } from '../../config/tabs'
import { getAllFaculties, listDir } from '../../lib/github'
import toast from 'react-hot-toast'

export default function NotSubmittedList() {
  const [faculties,  setFaculties]  = useState([])
  const [submitted,  setSubmitted]  = useState({})   // { tabId: Set of userIds }
  const [loading,    setLoading]    = useState(true)
  const [selectedTab, setSelectedTab] = useState(TABS[0].id)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const fList = await getAllFaculties()
      setFaculties(fList)

      // For each tab, get list of userIds that have submitted
      const matrix = {}
      await Promise.all(TABS.map(async tab => {
        const files = await listDir(`records/${tab.id}`)
        matrix[tab.id] = new Set(
          files.filter(f => f.name.endsWith('.json')).map(f => f.name.replace('.json',''))
        )
      }))
      setSubmitted(matrix)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const tab          = TABS.find(t => t.id === selectedTab)
  const submittedIds = submitted[selectedTab] || new Set()
  const notSubmitted = faculties.filter(f => !submittedIds.has(f.id))
  const hasSubmitted = faculties.filter(f =>  submittedIds.has(f.id))

  // Copy email list to clipboard
  function copyEmails() {
    const emails = notSubmitted.map(f => f.email).join(', ')
    navigator.clipboard.writeText(emails)
    toast.success(`${notSubmitted.length} email addresses copied to clipboard!`)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-pdeu-blue dark:text-white mb-2">📋 Submission Status</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        See which faculty haven't submitted for a given tab. Copy their emails to send reminders.
      </p>

      {/* Tab selector */}
      <div className="card mb-6">
        <label className="form-label">Select Tab to Check</label>
        <select value={selectedTab} onChange={e => setSelectedTab(e.target.value)} className="form-input max-w-md">
          {TABS.map(t => <option key={t.id} value={t.id}>{t.number}. {t.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="w-8 h-8 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
          Loading submission data…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Not submitted */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs flex items-center justify-center font-bold">{notSubmitted.length}</span>
                Not Submitted
              </h2>
              {notSubmitted.length > 0 && (
                <button onClick={copyEmails} className="btn-secondary text-xs">
                  📋 Copy Emails
                </button>
              )}
            </div>
            {notSubmitted.length === 0 ? (
              <p className="text-green-600 dark:text-green-400 text-sm font-medium">
                🎉 All faculty have submitted!
              </p>
            ) : (
              <div className="space-y-1.5">
                {notSubmitted.map(f => (
                  <div key={f.id} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0"/>
                    <span className="text-gray-700 dark:text-gray-300 flex-1 truncate">{f.fullName}</span>
                    <span className="text-gray-400 dark:text-gray-500 text-xs truncate max-w-[160px]">{f.email}</span>
                  </div>
                ))}
              </div>
            )}
            {notSubmitted.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Reminder email addresses:</p>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 text-xs font-mono text-gray-600 dark:text-gray-300 break-all">
                  {notSubmitted.map(f => f.email).join(', ')}
                </div>
              </div>
            )}
          </div>

          {/* Submitted */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs flex items-center justify-center font-bold">{hasSubmitted.length}</span>
              Submitted
            </h2>
            <div className="space-y-1.5">
              {hasSubmitted.length === 0 ? (
                <p className="text-gray-400 dark:text-gray-500 text-sm">No submissions yet.</p>
              ) : hasSubmitted.map(f => (
                <div key={f.id} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0"/>
                  <span className="text-gray-700 dark:text-gray-300">{f.fullName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Overall summary */}
      {!loading && (
        <div className="card mt-6">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Overall Submission Rate — All Tabs</h2>
          <div className="space-y-2">
            {TABS.map(t => {
              const count = submitted[t.id]?.size || 0
              const pct   = faculties.length ? Math.round((count / faculties.length) * 100) : 0
              return (
                <div key={t.id} className="flex items-center gap-3">
                  <span className="text-sm w-6">{t.icon}</span>
                  <span className="text-xs text-gray-600 dark:text-gray-300 w-48 truncate">{t.number}. {t.name}</span>
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-400' : pct >= 50 ? 'bg-pdeu-blue' : 'bg-gray-300'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-16 text-right">{count}/{faculties.length}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
