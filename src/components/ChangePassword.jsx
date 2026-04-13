import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { readJSON, writeJSON } from '../lib/github'
import { hashPassword } from '../lib/auth'
import toast from 'react-hot-toast'

export default function ChangePassword() {
  const { session } = useAuth()
  const [current,  setCurrent]  = useState('')
  const [next,     setNext]     = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [done,     setDone]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (next.length < 6) { toast.error('New password must be at least 6 characters.'); return }
    if (next !== confirm) { toast.error('New passwords do not match.'); return }

    setLoading(true)
    try {
      const { data, sha } = await readJSON('users.json')
      if (!data) throw new Error('Could not load users.')
      const user = data.find(u => u.id === session.userId)
      if (!user) throw new Error('Your account was not found.')
      if (hashPassword(current, user.salt) !== user.passwordHash)
        throw new Error('Current password is incorrect.')

      const updated = data.map(u =>
        u.id === session.userId ? { ...u, passwordHash: hashPassword(next, user.salt) } : u
      )
      await writeJSON('users.json', updated, sha)
      setDone(true)
      setCurrent(''); setNext(''); setConfirm('')
      toast.success('Password changed successfully!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-pdeu-blue dark:text-white mb-2">🔒 Change Password</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        Logged in as <strong className="text-gray-700 dark:text-gray-200">{session?.fullName}</strong>
      </p>

      {done && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 mb-6 text-sm text-green-700 dark:text-green-400">
          ✅ Password updated. Use your new password next time you log in.
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Current Password', val: current, set: setCurrent },
            { label: 'New Password', val: next, set: setNext, hint: 'At least 6 characters' },
            { label: 'Confirm New Password', val: confirm, set: setConfirm },
          ].map(({ label, val, set, hint }) => (
            <div key={label}>
              <label className="form-label">{label}</label>
              <input type="password" className="form-input" value={val}
                onChange={e => set(e.target.value)} placeholder={hint || '••••••••'} required />
            </div>
          ))}
          <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
            {loading ? '⏳ Saving…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
