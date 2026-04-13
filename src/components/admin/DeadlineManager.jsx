import { useEffect, useState } from 'react'
import { getSettings, saveSettings } from '../../lib/github'
import toast from 'react-hot-toast'

export default function DeadlineManager() {
  const [settings, setSettings] = useState({ deadline: '', message: '' })
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    getSettings().then(s => { setSettings({ deadline: s.deadline || '', message: s.message || '' }); setLoading(false) })
      .catch(e => { toast.error(e.message); setLoading(false) })
  }, [])

  async function save() {
    setSaving(true)
    try {
      await saveSettings(settings)
      toast.success('Deadline saved! Faculty will see the countdown immediately.')
    } catch (e) { toast.error(e.message) }
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

  // Compute days remaining
  const daysLeft = settings.deadline
    ? Math.ceil((new Date(settings.deadline) - new Date()) / 86400000)
    : null

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-pdeu-blue mb-2">⏰ Submission Deadline</h1>
      <p className="text-gray-500 text-sm mb-8">
        Set a data collection deadline. Faculty will see a countdown banner on their dashboard.
      </p>

      {/* Current status */}
      {settings.deadline && (
        <div className={`rounded-xl p-4 mb-6 ${daysLeft < 0 ? 'bg-red-50 border border-red-200' : daysLeft <= 3 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
          <p className="font-semibold text-gray-800 dark:text-gray-100">Current Deadline</p>
          <p className="text-2xl font-bold mt-1 text-pdeu-blue">
            {new Date(settings.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-sm mt-1">
            {daysLeft < 0
              ? <span className="text-red-600 font-medium">⚠️ Deadline passed {Math.abs(daysLeft)} days ago</span>
              : daysLeft === 0
              ? <span className="text-amber-600 font-medium">⚠️ Deadline is TODAY</span>
              : <span className="text-green-600 font-medium">✅ {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining</span>
            }
          </p>
          {settings.message && <p className="text-sm text-gray-600 mt-2 italic">"{settings.message}"</p>}
        </div>
      )}

      <div className="card space-y-5">
        <div>
          <label className="form-label">Submission Deadline Date</label>
          <input type="date" className="form-input" value={settings.deadline}
            onChange={e => setSettings(p => ({ ...p, deadline: e.target.value }))}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
        <div>
          <label className="form-label">Custom Message to Faculty <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea className="form-input resize-none" rows={2} value={settings.message}
            onChange={e => setSettings(p => ({ ...p, message: e.target.value }))}
            placeholder="e.g. Please ensure all publications for 2024-25 are entered before the deadline." />
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={save} disabled={saving || !settings.deadline} className="btn-primary">
            {saving ? '⏳ Saving…' : '💾 Set Deadline'}
          </button>
          {settings.deadline && (
            <button onClick={clear} disabled={saving} className="btn-secondary text-red-500 border-red-300">
              Clear Deadline
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300">
        <p className="font-semibold mb-1">What faculty see:</p>
        <ul className="space-y-1 text-xs list-disc list-inside">
          <li>A countdown banner at the top of their dashboard</li>
          <li>Banner turns amber when ≤ 7 days remain</li>
          <li>Banner turns red when deadline has passed</li>
          <li>Faculty can still submit after deadline but see a warning</li>
        </ul>
      </div>
    </div>
  )
}
