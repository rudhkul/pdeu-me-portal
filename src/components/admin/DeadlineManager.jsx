import { useEffect, useState } from 'react'
import { getSettings, saveSettings } from '../../lib/github'
import toast from 'react-hot-toast'

export default function DeadlineManager() {
  const [settings, setSettings] = useState({ deadline: '', message: '' })
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    getSettings()
      .then(s => { setSettings({ deadline: s.deadline || '', message: s.message || '' }); setLoading(false) })
      .catch(e => { toast.error(e.message); setLoading(false) })
  }, [])

  async function save() {
    setSaving(true)
    try { await saveSettings(settings); toast.success('Deadline saved!') }
    catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function clear() {
    if (!confirm('Remove the deadline? Faculty countdown will disappear.')) return
    setSaving(true)
    try {
      await saveSettings({ deadline: '', message: '' })
      setSettings({ deadline: '', message: '' })
      toast.success('Deadline cleared')
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const daysLeft = settings.deadline
    ? Math.ceil((new Date(settings.deadline) - new Date()) / 86400000)
    : null

  const statusCls = daysLeft === null ? '' :
    daysLeft < 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' :
    daysLeft <= 3 ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' :
    'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-pdeu-blue dark:text-white mb-2">⏰ Submission Deadline</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        Set a data collection deadline. Faculty see a countdown banner on their dashboard.
      </p>

      {settings.deadline && (
        <div className={`rounded-xl p-4 mb-6 border ${statusCls}`}>
          <p className="font-semibold text-gray-800 dark:text-gray-100">Current Deadline</p>
          <p className="text-2xl font-bold mt-1 text-pdeu-blue dark:text-blue-400">
            {new Date(settings.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-sm mt-1 text-gray-600 dark:text-gray-300">
            {daysLeft < 0 ? `⚠️ Deadline passed ${Math.abs(daysLeft)} days ago`
              : daysLeft === 0 ? '⚠️ Deadline is TODAY'
              : `✅ ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`}
          </p>
          {settings.message && <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 italic">"{settings.message}"</p>}
        </div>
      )}

      <div className="card space-y-5">
        <div>
          <label className="form-label">Submission Deadline Date</label>
          <input type="date" className="form-input" value={settings.deadline}
            onChange={e => setSettings(p => ({ ...p, deadline: e.target.value }))}
            min={new Date().toISOString().split('T')[0]} />
        </div>
        <div>
          <label className="form-label">
            Custom Message <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea className="form-input resize-none" rows={2} value={settings.message}
            onChange={e => setSettings(p => ({ ...p, message: e.target.value }))}
            placeholder="e.g. Please ensure all publications for 2024-25 are entered before the deadline." />
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={save} disabled={saving || !settings.deadline} className="btn-primary">
            {saving ? '⏳ Saving…' : '💾 Set Deadline'}
          </button>
          {settings.deadline && (
            <button onClick={clear} disabled={saving} className="btn-secondary !text-red-500 !border-red-300">
              Clear Deadline
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300">
        <p className="font-semibold mb-1">What faculty see:</p>
        <ul className="space-y-1 text-xs list-disc list-inside text-blue-600 dark:text-blue-400">
          <li>A countdown banner at the top of their dashboard</li>
          <li>Banner turns amber when ≤ 7 days remain</li>
          <li>Banner turns red when deadline has passed</li>
        </ul>
      </div>
    </div>
  )
}
