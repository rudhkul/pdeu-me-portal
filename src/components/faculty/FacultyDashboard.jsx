import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getFacultyRecords, getSettings } from '../../lib/github'
import { TABS } from '../../config/tabs'

function OnboardingBanner({ filledTabs, onDismiss }) {
  if (filledTabs > 0) return null   // Already started — no need to show
  return (
    <div className="bg-pdeu-light dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-start">
      <span className="text-2xl">👋</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-pdeu-blue dark:text-blue-300">Welcome to the DIC Mechanical Data Portal!</p>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Please fill in your data across all 20 sections. Here's how to get started:
        </p>
        <ol className="text-sm text-gray-600 dark:text-gray-400 mt-2 space-y-1 list-decimal list-inside">
          <li>Start with <strong className="text-gray-700 dark:text-gray-300">Tab 1 — Faculty Information</strong> (your profile)</li>
          <li>Work through each tab and add all relevant entries</li>
          <li>For file attachments, upload to OneDrive and paste the sharing link</li>
          <li>You can save, edit, and come back anytime — progress is always saved</li>
        </ol>
      </div>
      <button onClick={onDismiss}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm flex-shrink-0">
        ✕ Dismiss
      </button>
    </div>
  )
}

function AnnouncementBanner({ announcements }) {
  if (!announcements?.length) return null
  const typeStyles = {
    info:    'bg-blue-50  dark:bg-blue-900/20  border-blue-200  dark:border-blue-700  text-blue-800  dark:text-blue-300',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300',
    urgent:  'bg-red-50   dark:bg-red-900/20   border-red-200   dark:border-red-700   text-red-800   dark:text-red-300',
  }
  const typeIcons = { info: 'ℹ️', warning: '⚠️', urgent: '🚨' }
  return (
    <div className="space-y-2 mb-4">
      {announcements.map(ann => (
        <div key={ann.id} className={`border rounded-xl px-4 py-3 flex items-start gap-3 ${typeStyles[ann.type] || typeStyles.info}`}>
          <span className="flex-shrink-0 text-base">{typeIcons[ann.type] || 'ℹ️'}</span>
          <div>
            <p className="font-semibold text-sm">{ann.title}</p>
            <p className="text-xs mt-0.5 opacity-80">{ann.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function DeadlineBanner({ deadline, message }) {
  if (!deadline) return null
  const daysLeft = Math.ceil((new Date(deadline) - new Date()) / 86400000)
  const isPast   = daysLeft < 0
  const isUrgent = daysLeft >= 0 && daysLeft <= 7

  const cls = isPast
    ? 'bg-red-50 dark:bg-red-900/20 border-red-300 text-red-700 dark:text-red-300'
    : isUrgent
    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 text-amber-700 dark:text-amber-300'
    : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 text-blue-700 dark:text-blue-300'

  return (
    <div className={`border rounded-xl px-4 py-3 mb-6 flex flex-wrap items-center gap-3 ${cls}`}>
      <span className="text-lg">{isPast ? '⚠️' : isUrgent ? '⏰' : '📅'}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">
          {isPast
            ? `Data collection deadline passed ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ago`
            : daysLeft === 0
            ? 'Deadline is TODAY — please submit now!'
            : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining until submission deadline`
          }
          {' · '}
          <span className="font-normal">{new Date(deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </p>
        {message && <p className="text-xs mt-0.5 opacity-80">{message}</p>}
      </div>
    </div>
  )
}

export default function FacultyDashboard() {
  const { session } = useAuth()
  const [showOnboarding, setShowOnboarding] = useState(
    () => !localStorage.getItem('onboarding_dismissed')
  )
  function dismissOnboarding() {
    localStorage.setItem('onboarding_dismissed', '1')
    setShowOnboarding(false)
  }
  const [counts,   setCounts]   = useState({})
  const [loading,  setLoading]  = useState(true)
  const [deadline,      setDeadline]      = useState(null)
  const [message,       setMessage]       = useState('')
  const [announcements, setAnnouncements] = useState([])

  useEffect(() => {
    async function load() {
      const [settingsRes, countResults] = await Promise.all([
        getSettings().catch(() => ({})),
        Promise.all(TABS.map(async tab => {
          try {
            const records = await getFacultyRecords(tab.id, session.userId)
            return [tab.id, records.length]
          } catch { return [tab.id, 0] }
        }))
      ])
      setDeadline(settingsRes.deadline || null)
      setMessage(settingsRes.message || '')
      setAnnouncements(settingsRes.announcements || [])
      setCounts(Object.fromEntries(countResults))
      setLoading(false)
    }
    load()
  }, [])

  const filledTabs = Object.values(counts).filter(c => c > 0).length
  const totalTabs  = TABS.length
  const pct        = Math.round((filledTabs / totalTabs) * 100)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-pdeu-blue">Welcome, {session?.fullName} 👋</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          {loading ? 'Loading your data…' : `${filledTabs} of ${totalTabs} sections have entries`}
        </p>
        <Link to="/faculty/profile" className="mt-1 text-xs text-pdeu-blue dark:text-blue-400 hover:underline">
          🖨️ Print / Save my data summary →
        </Link>
      </div>

      {/* Onboarding banner — shown only on first visit */}
      {showOnboarding && (
        <OnboardingBanner filledTabs={filledTabs} onDismiss={dismissOnboarding} />
      )}

      {/* Announcements */}
      <AnnouncementBanner announcements={announcements} />

      {/* Deadline banner */}
      <DeadlineBanner deadline={deadline} message={message} />

      {/* Completion tracker */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="font-semibold text-gray-800 dark:text-gray-100">Data Completion</p>
            <p className="text-xs text-gray-400 mt-0.5">{filledTabs} / {totalTabs} sections filled</p>
          </div>
          <span className={`text-2xl font-bold ${pct === 100 ? 'text-green-600' : pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
            {loading ? '…' : `${pct}%`}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-pdeu-blue'}`}
            style={{ width: loading ? '0%' : `${pct}%` }}
          />
        </div>

        {/* Mini tab status grid */}
        {!loading && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {TABS.map(tab => (
              <Link
                key={tab.id}
                to={`/faculty/tab/${tab.id}`}
                title={`${tab.name} — ${counts[tab.id] || 0} entries`}
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold transition-colors
                  ${(counts[tab.id] || 0) > 0
                    ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-500'
                  }`}
              >
                {tab.number}
              </Link>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-400 mt-2">
          <span className="inline-block w-3 h-3 bg-green-100 dark:bg-green-900/30 rounded mr-1 align-middle" />filled
          <span className="inline-block w-3 h-3 bg-gray-100 dark:bg-gray-700 rounded ml-3 mr-1 align-middle" />empty
        </p>
      </div>

      {/* Tab cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {TABS.map(tab => {
          const count = counts[tab.id] || 0
          const filled = count > 0
          return (
            <Link key={tab.id} to={`/faculty/tab/${tab.id}`}
              className={`card hover:shadow-md transition-all group border-l-4
                ${filled ? 'border-l-green-400' : 'border-l-gray-200 dark:border-l-gray-600'}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{tab.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm group-hover:text-pdeu-blue leading-tight">
                    {tab.number}. {tab.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">{tab.description}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                  ${filled
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-700'
                  }`}>
                  {loading ? '…' : filled ? `${count} ${tab.isProfile ? 'record' : 'entries'}` : 'No entries yet'}
                </span>
                <span className="text-pdeu-blue text-xs opacity-0 group-hover:opacity-100 transition-opacity font-medium">Open →</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
