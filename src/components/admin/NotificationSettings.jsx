import { useEffect, useState } from 'react'
import { getSettings, saveSettings } from '../../lib/github'
import toast from 'react-hot-toast'

// Shows EmailJS setup instructions + lets admin toggle notifications on/off per tab
export default function NotificationSettings() {
  const [settings, setSettings] = useState({ notifications_enabled: true })
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  const isConfigured = !!(
    import.meta.env.VITE_EMAILJS_SERVICE_ID &&
    import.meta.env.VITE_EMAILJS_TEMPLATE_ID &&
    import.meta.env.VITE_EMAILJS_PUBLIC_KEY
  )

  useEffect(() => {
    getSettings()
      .then(s => { setSettings(s); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function save() {
    setSaving(true)
    try { await saveSettings(settings); toast.success('Saved!') }
    catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const stepCls  = 'flex gap-4 items-start'
  const numCls   = 'w-7 h-7 rounded-full bg-pdeu-blue text-white text-sm font-bold flex items-center justify-center flex-shrink-0 mt-0.5'
  const codeCls  = 'font-mono bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 px-2 py-0.5 rounded text-xs'

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-pdeu-blue dark:text-white mb-2">📧 Email Notifications</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        When a faculty saves data, the admin who owns that tab receives an email automatically.
        Uses EmailJS — free, no backend needed.
      </p>

      {/* Status badge */}
      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-8
        ${isConfigured
          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
        }`}>
        {isConfigured ? '✅ EmailJS is configured' : '⚠️ EmailJS is not configured yet'}
      </div>

      {!isConfigured && (
        <div className="card mb-8">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-6">Setup Instructions</h2>
          <div className="space-y-6">

            <div className={stepCls}>
              <div className={numCls}>1</div>
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100">Create a free EmailJS account</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Go to <a href="https://www.emailjs.com" target="_blank" rel="noreferrer"
                    className="text-pdeu-blue underline">emailjs.com</a> → Sign up free.
                  Free plan gives 200 emails/month which is more than enough.
                </p>
              </div>
            </div>

            <div className={stepCls}>
              <div className={numCls}>2</div>
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100">Connect your email service</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  EmailJS dashboard → <strong>Email Services</strong> → Add New Service → Gmail (or Outlook).
                  Connect using your institutional email. Note the <span className={codeCls}>Service ID</span>.
                </p>
              </div>
            </div>

            <div className={stepCls}>
              <div className={numCls}>3</div>
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100">Create an email template</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-3">
                  EmailJS dashboard → <strong>Email Templates</strong> → Create New Template.
                  Use this template content:
                </p>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 text-sm font-mono text-gray-700 dark:text-gray-300 space-y-1 border border-gray-200 dark:border-gray-600">
                  <p><strong>Subject:</strong> [ME Portal] {"{{faculty_name}}"} {"{{action}}"} data in {"{{tab_name}}"}</p>
                  <br/>
                  <p>Hi {"{{to_name}}"},</p>
                  <br/>
                  <p>{"{{faculty_name}}"} has <strong>{"{{action}}"}</strong> a record in the <strong>{"{{tab_name}}"}</strong> tab.</p>
                  <br/>
                  <p>Time: {"{{timestamp}}"}</p>
                  <br/>
                  <p>View it here: {"{{portal_url}}"}</p>
                  <br/>
                  <p>— ME Dept Data Portal, PDEU</p>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  Note the <span className={codeCls}>Template ID</span>.
                </p>
              </div>
            </div>

            <div className={stepCls}>
              <div className={numCls}>4</div>
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100">Get your Public Key</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  EmailJS dashboard → <strong>Account</strong> → API Keys → copy the <strong>Public Key</strong>.
                </p>
              </div>
            </div>

            <div className={stepCls}>
              <div className={numCls}>5</div>
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-100">Add to GitHub Secrets</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-2">
                  Go to <strong>github.com/rudhkul/pdeu-me-portal → Settings → Secrets → Actions</strong> and add:
                </p>
                <div className="space-y-1.5">
                  {[
                    ['VITE_EMAILJS_SERVICE_ID',   'service_xxxxxxx'],
                    ['VITE_EMAILJS_TEMPLATE_ID',  'template_xxxxxxx'],
                    ['VITE_EMAILJS_PUBLIC_KEY',   'your public key'],
                    ['VITE_ADMIN_EMAIL_Salman',   'salman@sot.pdpu.ac.in'],
                    ['VITE_ADMIN_EMAIL_Krunal',   'krunal@sot.pdpu.ac.in'],
                    ['VITE_ADMIN_EMAIL_VivekJaiswal', 'vivek.jaiswal@sot.pdpu.ac.in'],
                    ['VITE_ADMIN_EMAIL_Anirudh',  'anirudh@sot.pdpu.ac.in'],
                    ['VITE_ADMIN_EMAIL_Abhinaya', 'abhinaya@sot.pdpu.ac.in'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center gap-3 text-xs">
                      <span className={`${codeCls} w-72`}>{k}</span>
                      <span className="text-gray-400 dark:text-gray-500">=</span>
                      <span className="text-gray-500 dark:text-gray-400 italic">{v}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
                  Then push any commit to trigger a redeploy with the new secrets.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Toggle */}
      {isConfigured && (
        <div className="card">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Notification Settings</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="relative">
              <input type="checkbox"
                checked={settings.notifications_enabled !== false}
                onChange={e => setSettings(p => ({ ...p, notifications_enabled: e.target.checked }))}
                className="sr-only"
              />
              <div className={`w-11 h-6 rounded-full transition-colors ${
                settings.notifications_enabled !== false ? 'bg-pdeu-blue' : 'bg-gray-300 dark:bg-gray-600'
              }`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mt-0.5 ml-0.5 ${
                  settings.notifications_enabled !== false ? 'translate-x-5' : ''
                }`} />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                {settings.notifications_enabled !== false ? 'Notifications enabled' : 'Notifications disabled'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Admins receive an email when faculty save or delete records in their tabs.
              </p>
            </div>
          </label>
          <button onClick={save} disabled={saving} className="btn-primary mt-6">
            {saving ? '⏳ Saving…' : '💾 Save'}
          </button>
        </div>
      )}
    </div>
  )
}
