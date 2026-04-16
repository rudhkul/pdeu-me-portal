import { useEffect, useState } from 'react'
import { getSettings, saveSettings } from '../../lib/github'
import toast from 'react-hot-toast'

export default function Announcements() {
  const [settings, setSettings] = useState({ announcements: [] })
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [newMsg,   setNewMsg]   = useState({ title: '', body: '', type: 'info' })

  useEffect(() => {
    getSettings().then(s => {
      setSettings({ ...s, announcements: s.announcements || [] })
      setLoading(false)
    }).catch(e => { toast.error(e.message); setLoading(false) })
  }, [])

  async function persist(updated) {
    setSaving(true)
    try { await saveSettings(updated); setSettings(updated); toast.success('Saved!') }
    catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  function addAnnouncement() {
    if (!newMsg.title.trim() || !newMsg.body.trim()) { toast.error('Title and message are required'); return }
    const ann = {
      id:        crypto.randomUUID(),
      title:     newMsg.title.trim(),
      body:      newMsg.body.trim(),
      type:      newMsg.type,
      createdAt: new Date().toISOString(),
    }
    persist({ ...settings, announcements: [ann, ...(settings.announcements || [])] })
    setNewMsg({ title: '', body: '', type: 'info' })
  }

  function remove(id) {
    persist({ ...settings, announcements: settings.announcements.filter(a => a.id !== id) })
  }

  const typeStyles = {
    info:    'bg-blue-50  dark:bg-blue-900/20  border-blue-200  dark:border-blue-700  text-blue-800  dark:text-blue-300',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300',
    urgent:  'bg-red-50   dark:bg-red-900/20   border-red-200   dark:border-red-700   text-red-800   dark:text-red-300',
  }
  const typeIcons = { info: 'ℹ️', warning: '⚠️', urgent: '🚨' }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-pdeu-blue dark:text-white mb-2">📢 Announcements</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        Post announcements for all faculty. They appear as banners on the faculty dashboard.
      </p>

      {/* Add new */}
      <div className="card mb-8">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Post New Announcement</h2>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="form-label">Title</label>
              <input className="form-input" value={newMsg.title}
                onChange={e => setNewMsg(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. DIC Audit — Submit Tab 6 by Friday" />
            </div>
            <div>
              <label className="form-label">Type</label>
              <select className="form-input" value={newMsg.type}
                onChange={e => setNewMsg(p => ({ ...p, type: e.target.value }))}>
                <option value="info">ℹ️ Info</option>
                <option value="warning">⚠️ Warning</option>
                <option value="urgent">🚨 Urgent</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Message</label>
            <textarea className="form-input resize-none" rows={2} value={newMsg.body}
              onChange={e => setNewMsg(p => ({ ...p, body: e.target.value }))}
              placeholder="Please ensure all Publications (Tab 5) entries for 2024-25 are filled with proof PDFs before Friday 5 PM." />
          </div>
          <button onClick={addAnnouncement} disabled={saving} className="btn-primary">
            {saving ? '⏳ Posting…' : '📢 Post Announcement'}
          </button>
        </div>
      </div>

      {/* Active announcements */}
      <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">
        Active Announcements ({settings.announcements?.length || 0})
      </h2>
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading…</div>
      ) : !settings.announcements?.length ? (
        <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">
          No announcements yet. Faculty see their dashboard normally.
        </p>
      ) : (
        <div className="space-y-3">
          {settings.announcements.map(ann => (
            <div key={ann.id} className={`border rounded-xl p-4 flex items-start gap-3 ${typeStyles[ann.type] || typeStyles.info}`}>
              <span className="text-lg flex-shrink-0">{typeIcons[ann.type] || 'ℹ️'}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{ann.title}</p>
                <p className="text-xs mt-0.5 opacity-80">{ann.body}</p>
                <p className="text-xs opacity-60 mt-1">
                  Posted {new Date(ann.createdAt).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                </p>
              </div>
              <button onClick={() => remove(ann.id)} className="flex-shrink-0 text-xs opacity-50 hover:opacity-100">✕ Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
