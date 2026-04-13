import { useEffect, useState } from 'react'
import { getRawUsers, saveRawUsers } from '../../lib/github'
import { hashPassword } from '../../lib/auth'
import toast from 'react-hot-toast'
import { randomBytes, createHash } from 'crypto'

function randomId()   { return `usr_${Math.random().toString(36).slice(2, 10)}` }
function randomSalt() { return Math.random().toString(36).repeat(4).slice(0, 32) }

export default function AdminUsers() {
  const [users,    setUsers]    = useState([])
  const [sha,      setSha]      = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [editId,   setEditId]   = useState(null)
  const [showAdd,  setShowAdd]  = useState(false)
  const [form,     setForm]     = useState({ fullName: '', email: '', role: 'faculty', password: '' })
  const [editForm, setEditForm] = useState({})
  const [newPwd,   setNewPwd]   = useState({})  // { userId: password }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const { users: u, sha: s } = await getRawUsers()
      setUsers(u); setSha(s)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  async function persist(newUsers) {
    setSaving(true)
    try {
      await saveRawUsers(newUsers, sha)
      const { sha: newSha } = await getRawUsers().then(r => ({ sha: r.sha }))
      // re-read to get new sha
      const { users: u, sha: s } = await getRawUsers()
      setUsers(u); setSha(s)
      toast.success('Saved!')
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  async function addUser() {
    if (!form.fullName || !form.email || !form.password) { toast.error('All fields required'); return }
    if (users.find(u => u.email.toLowerCase() === form.email.toLowerCase())) {
      toast.error('Email already exists'); return
    }
    const salt = randomSalt()
    const newUser = {
      id: randomId(), fullName: form.fullName, email: form.email,
      role: form.role, salt, passwordHash: hashPassword(form.password, salt),
    }
    await persist([...users, newUser])
    setShowAdd(false)
    setForm({ fullName: '', email: '', role: 'faculty', password: '' })
  }

  async function saveEdit(id) {
    const ef = editForm[id] || {}
    const updated = users.map(u => u.id === id ? { ...u, ...ef } : u)
    await persist(updated)
    setEditId(null)
  }

  async function resetPassword(id) {
    const pwd = newPwd[id]
    if (!pwd || pwd.length < 6) { toast.error('Password must be at least 6 characters'); return }
    const user = users.find(u => u.id === id)
    const updated = users.map(u =>
      u.id === id ? { ...u, passwordHash: hashPassword(pwd, u.salt) } : u
    )
    await persist(updated)
    setNewPwd(p => ({ ...p, [id]: '' }))
    toast.success(`Password reset for ${user.fullName}`)
  }

  async function removeUser(id) {
    const u = users.find(u => u.id === id)
    if (!confirm(`Remove ${u.fullName}? They will lose all access immediately.`)) return
    await persist(users.filter(u => u.id !== id))
  }

  const faculty = users.filter(u => u.role === 'faculty')
  const admins  = users.filter(u => u.role === 'admin')

  function UserRow({ u }) {
    const isEditing = editId === u.id
    const ef = editForm[u.id] || {}
    return (
      <div className="border border-gray-100 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-pdeu-blue text-white text-sm flex items-center justify-center font-bold flex-shrink-0">
            {u.fullName[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2">
                <input className="form-input text-sm" defaultValue={u.fullName}
                  onChange={e => setEditForm(p => ({ ...p, [u.id]: { ...p[u.id], fullName: e.target.value } }))} />
                <input className="form-input text-sm" defaultValue={u.email} type="email"
                  onChange={e => setEditForm(p => ({ ...p, [u.id]: { ...p[u.id], email: e.target.value } }))} />
                <select className="form-input text-sm" defaultValue={u.role}
                  onChange={e => setEditForm(p => ({ ...p, [u.id]: { ...p[u.id], role: e.target.value } }))}>
                  <option value="faculty">Faculty</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            ) : (
              <>
                <p className="font-medium text-gray-800 dark:text-gray-100 text-sm">{u.fullName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{u.email}</p>
              </>
            )}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
            {u.role}
          </span>
        </div>

        {/* Reset password */}
        <div className="flex gap-2 pt-1">
          <input type="password" placeholder="New password (6+ chars)"
            value={newPwd[u.id] || ''}
            onChange={e => setNewPwd(p => ({ ...p, [u.id]: e.target.value }))}
            className="form-input text-xs flex-1" />
          <button onClick={() => resetPassword(u.id)} className="btn-secondary text-xs px-3 whitespace-nowrap">
            Reset Pwd
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button onClick={() => saveEdit(u.id)} disabled={saving} className="btn-primary text-xs">Save</button>
              <button onClick={() => setEditId(null)} className="btn-secondary text-xs">Cancel</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditId(u.id)} className="btn-secondary text-xs">Edit</button>
              <button onClick={() => removeUser(u.id)} className="text-xs text-red-400 hover:text-red-600 hover:underline ml-auto">Remove</button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-pdeu-blue">👥 User Management</h1>
          <p className="text-gray-500 text-sm mt-1">{faculty.length} faculty · {admins.length} admins</p>
        </div>
        <button onClick={() => setShowAdd(s => !s)} className="btn-primary">
          {showAdd ? 'Cancel' : '+ Add Faculty'}
        </button>
      </div>

      {/* Add user form */}
      {showAdd && (
        <div className="card mb-8 border-2 border-pdeu-blue">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Add New User</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="form-label">Full Name *</label>
              <input className="form-input" value={form.fullName} onChange={e => setForm(p => ({...p, fullName: e.target.value}))} /></div>
            <div><label className="form-label">Email *</label>
              <input className="form-input" type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></div>
            <div><label className="form-label">Role</label>
              <select className="form-input" value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value}))}>
                <option value="faculty">Faculty</option>
                <option value="admin">Admin</option>
              </select></div>
            <div><label className="form-label">Temporary Password *</label>
              <input className="form-input" type="password" value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))} /></div>
          </div>
          <button onClick={addUser} disabled={saving} className="btn-primary mt-4">
            {saving ? '⏳ Saving…' : 'Add User'}
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="w-8 h-8 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading users…
        </div>
      ) : (
        <div className="space-y-8">
          {/* Admins */}
          <div>
            <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              🛡️ Admins <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{admins.length}</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {admins.map(u => <UserRow key={u.id} u={u} />)}
            </div>
          </div>

          {/* Faculty */}
          <div>
            <h2 className="font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              👤 Faculty <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{faculty.length}</span>
            </h2>
            {faculty.length === 0
              ? <p className="text-gray-400 text-sm">No faculty added yet. Use the Add Faculty button above.</p>
              : <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{faculty.map(u => <UserRow key={u.id} u={u} />)}</div>
            }
          </div>
        </div>
      )}
    </div>
  )
}
