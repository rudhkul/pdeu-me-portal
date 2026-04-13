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

    if (next.length < 6) {
      toast.error('New password must be at least 6 characters.')
      return
    }
    if (next !== confirm) {
      toast.error('New passwords do not match.')
      return
    }

    setLoading(true)
    try {
      // Read users list
      const { data, sha } = await readJSON('users.json')
      if (!data) throw new Error('Could not load users.')

      const user = data.find(u => u.id === session.userId)
      if (!user) throw new Error('Your account was not found.')

      // Verify current password
      const currentHash = hashPassword(current, user.salt)
      if (currentHash !== user.passwordHash) {
        throw new Error('Current password is incorrect.')
      }

      // Write new password hash (reuse same salt)
      const newHash = hashPassword(next, user.salt)
      const updated = data.map(u =>
        u.id === session.userId ? { ...u, passwordHash: newHash } : u
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
      <h1 className="text-2xl font-bold text-pdeu-blue mb-2">🔒 Change Password</h1>
      <p className="text-gray-500 text-sm mb-8">
        Logged in as <strong>{session?.fullName}</strong>
      </p>

      {done && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-6 text-sm text-green-700">
          ✅ Password updated. Use your new password next time you log in.
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Current Password</label>
            <input
              type="password"
              className="form-input"
              value={current}
              onChange={e => setCurrent(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="form-label">New Password</label>
            <input
              type="password"
              className="form-input"
              value={next}
              onChange={e => setNext(e.target.value)}
              required
              minLength={6}
              placeholder="At least 6 characters"
            />
          </div>
          <div>
            <label className="form-label">Confirm New Password</label>
            <input
              type="password"
              className="form-input"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
            {loading ? '⏳ Saving…' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
