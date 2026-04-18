import { useEffect, useState } from 'react'
import { getUsers, getFacultyRecords } from '../../lib/github'
import { sendReminderEmail } from '../../lib/notify'
import { TABS } from '../../config/tabs'
import toast from 'react-hot-toast'

export default function NotSubmittedList() {
  const [faculty,   setFaculty]   = useState([])
  const [status,    setStatus]    = useState({})   // userId → { filled, total }
  const [loading,   setLoading]   = useState(true)
  const [sending,   setSending]   = useState({})   // userId → bool
  const [sentAll,   setSentAll]   = useState(false)
  const [message,   setMessage]   = useState('The data submission deadline is approaching. Please log in to the DIC Mechanical Portal and complete all required sections.')

  const dataTabs = TABS.filter(t => !t.isProfile)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const users = await getUsers()
      const faculty = users.filter(u => u.role === 'faculty')
      setFaculty(faculty)

      // Check how many tabs each faculty has filled
      const statusMap = {}
      await Promise.all(faculty.map(async u => {
        let filled = 0
        await Promise.all(dataTabs.map(async tab => {
          try {
            const recs = await getFacultyRecords(tab.id, u.id)
            if (recs?.length > 0) filled++
          } catch { }
        }))
        statusMap[u.id] = { filled, total: dataTabs.length }
      }))
      setStatus(statusMap)
    } catch (e) { toast.error(e.message) }
    setLoading(false)
  }

  async function sendReminder(user) {
    setSending(s => ({ ...s, [user.id]: true }))
    try {
      await sendReminderEmail({
        toName:   user.fullName,
        toEmail:  user.email,
        message,
        filled:   status[user.id]?.filled || 0,
        total:    status[user.id]?.total  || dataTabs.length,
        portalUrl: window.location.origin + window.location.pathname,
      })
      toast.success(`Reminder sent to ${user.fullName}`)
    } catch (e) {
      toast.error(`Failed to send to ${user.fullName}: ${e?.message || e?.text || String(e)}`)
    }
    setSending(s => ({ ...s, [user.id]: false }))
  }

  async function sendAll() {
    const pending = notSubmitted
    if (!pending.length) { toast('Everyone has submitted!'); return }
    setSentAll(true)
    let sent = 0
    for (const user of pending) {
      try {
        await sendReminderEmail({
          toName:   user.fullName,
          toEmail:  user.email,
          message,
          filled:   status[user.id]?.filled || 0,
          total:    status[user.id]?.total  || dataTabs.length,
          portalUrl: window.location.origin + window.location.pathname,
        })
        sent++
        // Small delay to avoid rate limiting EmailJS
        await new Promise(r => setTimeout(r, 500))
      } catch { }
    }
    toast.success(`Sent reminders to ${sent} of ${pending.length} faculty`)
    setSentAll(false)
  }

  function copyEmails() {
    const emails = notSubmitted.map(u => u.email).join(', ')
    navigator.clipboard.writeText(emails)
    toast.success('Emails copied to clipboard')
  }

  const notSubmitted = faculty.filter(u =>
    (status[u.id]?.filled || 0) < (status[u.id]?.total || dataTabs.length)
  )
  const submitted = faculty.filter(u =>
    status[u.id] && status[u.id].filled >= status[u.id].total
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-pdeu-blue dark:text-white mb-1">📋 Submission Status</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
        Track who has filled all tabs and send targeted email reminders.
      </p>

      {loading ? (
        <div className="card flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin"/>
          Loading submission data… this may take a moment.
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Total Faculty', val: faculty.length,       color: 'text-gray-700 dark:text-gray-200' },
              { label: 'Fully Submitted', val: submitted.length,   color: 'text-green-600 dark:text-green-400' },
              { label: 'Pending',         val: notSubmitted.length, color: 'text-red-600 dark:text-red-400' },
            ].map(s => (
              <div key={s.label} className="card text-center">
                <p className={`text-3xl font-bold ${s.color}`}>{s.val}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Reminder message editor */}
          {notSubmitted.length > 0 && (
            <div className="card mb-6">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                ✉️ Reminder Email Message
              </p>
              <textarea
                className="form-input text-sm"
                rows={3}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Type your reminder message…"
              />
              <div className="flex gap-3 mt-3 flex-wrap">
                <button onClick={sendAll} disabled={sentAll}
                  className="btn-primary text-sm flex items-center gap-2">
                  {sentAll
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Sending…</>
                    : `📧 Send to all ${notSubmitted.length} pending faculty`
                  }
                </button>
                <button onClick={copyEmails} className="btn-secondary text-sm">
                  📋 Copy emails
                </button>
              </div>
            </div>
          )}

          {/* Pending faculty */}
          {notSubmitted.length > 0 && (
            <div className="card mb-4">
              <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">
                ⚠️ Pending ({notSubmitted.length})
              </h2>
              <div className="space-y-2">
                {notSubmitted.map(u => {
                  const s = status[u.id] || { filled: 0, total: dataTabs.length }
                  const pct = Math.round((s.filled / s.total) * 100)
                  return (
                    <div key={u.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{u.fullName}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{u.email}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div className="h-full bg-pdeu-blue rounded-full"
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                            {s.filled}/{s.total} tabs
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => sendReminder(u)}
                        disabled={sending[u.id]}
                        className="btn-secondary text-xs flex-shrink-0 flex items-center gap-1">
                        {sending[u.id]
                          ? <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"/>
                          : '📧'
                        }
                        Remind
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Submitted faculty */}
          {submitted.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">
                ✅ Completed ({submitted.length})
              </h2>
              <div className="space-y-1.5">
                {submitted.map(u => (
                  <div key={u.id}
                    className="flex items-center gap-3 px-3 py-2 bg-green-50 dark:bg-green-900/10 rounded-lg">
                    <span className="text-green-500 flex-shrink-0">✓</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{u.fullName}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{u.email}</p>
                    </div>
                    <span className="ml-auto text-xs text-green-600 dark:text-green-400 font-medium">
                      All {status[u.id]?.total} tabs
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
