import { useEffect, useState } from 'react'
import { getRawUsers, saveRawUsers } from '../../lib/github'
import { hashPassword } from '../../lib/auth'
import toast from 'react-hot-toast'

function randomSalt() {
  const arr = new Uint8Array(16)
  window.crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('')
}

export default function AdminPasswordReset() {
  const [users,   setUsers]   = useState([])
  const [sha,     setSha]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [newPwds, setNewPwds] = useState({})
  const [saving,  setSaving]  = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { users: u, sha: s } = await getRawUsers()
      setUsers(u); setSha(s)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  async function resetPassword(userId) {
    const pwd = newPwds[userId]?.trim()
    if (!pwd || pwd.length < 6) { toast.error('Password must be at least 6 characters'); return }
    const user = users.find(u => u.id === userId)
    setSaving(userId)
    try {
      const updated = users.map(u =>
        u.id === userId ? { ...u, passwordHash: hashPassword(pwd, u.salt) } : u
      )
      await saveRawUsers(updated, sha)
      // Re-read to get new sha
      const { users: fresh, sha: newSha } = await getRawUsers()
      setUsers(fresh); setSha(newSha)
      setNewPwds(p => ({ ...p, [userId]: '' }))
      toast.success(`Password reset for ${user.fullName}`)
    } catch (e) { toast.error(e.message) }
    finally { setSaving(null) }
  }

  const faculty = users.filter(u => u.role === 'faculty')
  const admins  = users.filter(u => u.role === 'admin')

  function UserRow({ u }) {
    return (
      <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl">
        <div className="w-8 h-8 rounded-full bg-pdeu-blue text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
          {u.fullName[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{u.fullName}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{u.email}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <input
            type="password"
            placeholder="New password"
            value={newPwds[u.id] || ''}
            onChange={e => setNewPwds(p => ({ ...p, [u.id]: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && resetPassword(u.id)}
            className="form-input text-xs w-36"
          />
          <button
            onClick={() => resetPassword(u.id)}
            disabled={saving === u.id || !newPwds[u.id]?.trim()}
            className="btn-primary text-xs px-3 whitespace-nowrap disabled:opacity-50"
          >
            {saving === u.id ? '⏳' : 'Reset'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-pdeu-blue dark:text-white mb-2">🔑 Password Reset</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm mb-8">
        Reset any user's password directly from the portal. Type a new password and press Enter or click Reset.
      </p>

      {loading ? (
        <div className="text-center py-12 text-gray-400">
          <div className="w-8 h-8 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
          Loading users…
        </div>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3 flex items-center gap-2">
              🛡️ Admins <span className="text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-full">{admins.length}</span>
            </h2>
            <div className="space-y-2">{admins.map(u => <UserRow key={u.id} u={u} />)}</div>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3 flex items-center gap-2">
              👤 Faculty <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">{faculty.length}</span>
            </h2>
            <div className="space-y-2">{faculty.map(u => <UserRow key={u.id} u={u} />)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
