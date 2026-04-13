import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../hooks/useAuth'
import { getTab } from '../../config/tabs'
import { getFacultyRecords, addRecord, updateRecord, deleteRecord } from '../../lib/github'
import { notifyAdmin } from '../../lib/notify'
import DynamicField from '../common/DynamicField'
import toast from 'react-hot-toast'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function isDuplicate(records, values, editingId) {
  const keyFields = ['title', 'course_name', 'patent_number', 'student_name', 'event_name', 'training_name', 'project_title']
  const keyField  = keyFields.find(f => values[f])
  if (!keyField) return null
  const newVal = String(values[keyField]).toLowerCase().trim()
  return records.find(r =>
    r.id !== editingId && r[keyField] &&
    String(r[keyField]).toLowerCase().trim() === newVal
  )
}

export default function TabForm() {
  const { tabId }    = useParams()
  const { session }  = useAuth()
  const tab          = getTab(tabId)

  const [records,  setRecords]  = useState([])
  const [editing,  setEditing]  = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [isDirty,  setIsDirty]  = useState(false)

  const { register, handleSubmit, reset, watch, setValue,
          formState: { errors, isDirty: formDirty } } = useForm()

  useEffect(() => { setIsDirty(formDirty) }, [formDirty])

  useEffect(() => {
    if (!isDirty) return
    const fn = e => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', fn)
    return () => window.removeEventListener('beforeunload', fn)
  }, [isDirty])

  useEffect(() => {
    if (!showForm && !tab?.isProfile) return
    const fn = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        document.getElementById('tab-form-submit')?.click()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [showForm, tab])

  useEffect(() => { if (tab) fetchRecords() }, [tabId])

  async function fetchRecords() {
    setLoading(true)
    try {
      const data = await getFacultyRecords(tab.id, session.userId)
      setRecords(data)
      if (tab.isProfile && data.length > 0) reset(data[0])
    } catch (e) { toast.error('Failed to load: ' + e.message) }
    finally { setLoading(false) }
  }

  async function onSubmit(values) {
    const dup = isDuplicate(records, values, editing)
    if (dup && !confirm(
      `A similar entry already exists:\n"${dup.title || dup.course_name || dup.event_name || dup.student_name}"\n\nAdd anyway?`
    )) return

    setSaving(true)
    try {
      const payload = { ...values, facultyName: session.fullName }
      let action = 'added'

      if (tab.isProfile) {
        const cur     = records[0]
        const updated = cur
          ? await updateRecord(tab.id, session.userId, cur.id, payload)
          : await addRecord(tab.id, session.userId, payload)
        setRecords(updated)
        action = cur ? 'updated' : 'added'
        toast.success('Profile saved!')
      } else if (editing) {
        const updated = await updateRecord(tab.id, session.userId, editing, payload)
        setRecords(updated)
        setEditing(null); setShowForm(false); reset()
        action = 'updated'
        toast.success('Record updated!')
      } else {
        const updated = await addRecord(tab.id, session.userId, payload)
        setRecords(updated)
        setShowForm(false); reset()
        toast.success('Record saved!')
      }

      setIsDirty(false)

      // Fire-and-forget email notification to tab owner
      notifyAdmin({
        tabId:       tab.id,
        tabName:     tab.name,
        facultyName: session.fullName,
        action,
      })
    } catch (e) { toast.error('Save failed: ' + e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this record? Cannot be undone.')) return
    try {
      setRecords(await deleteRecord(tab.id, session.userId, id))
      toast.success('Deleted')
      notifyAdmin({ tabId: tab.id, tabName: tab.name, facultyName: session.fullName, action: 'deleted' })
    } catch (e) { toast.error(e.message) }
  }

  function startEdit(row) {
    setEditing(row.id); reset(row); setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelForm() {
    if (isDirty && !confirm('Discard unsaved changes?')) return
    reset(); setEditing(null); setShowForm(false); setIsDirty(false)
  }

  if (!tab) return <div className="p-8 text-center text-gray-500 dark:text-gray-400">Tab not found.</div>

  const previewFields = tab.fields
    .filter(f => !['file', 'textarea', 'boolean'].includes(f.type))
    .slice(0, 4)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link to="/faculty" className="text-gray-400 hover:text-pdeu-blue dark:hover:text-blue-400">← Dashboard</Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <h1 className="font-bold text-pdeu-blue dark:text-white text-lg flex items-center gap-2">
          {tab.icon} {tab.name}
        </h1>
      </div>

      {/* Saving indicator */}
      {saving && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 mb-4 text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Saving to repository…
        </div>
      )}

      {/* Unsaved changes */}
      {isDirty && !saving && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 mb-4 text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
          ⚠️ Unsaved changes —
          <kbd className="bg-amber-100 dark:bg-amber-800 px-1.5 py-0.5 rounded text-xs font-mono">Ctrl+S</kbd>
          to save quickly.
        </div>
      )}

      {/* Form */}
      {(showForm || tab.isProfile) && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">
              {editing ? '✏️ Edit Record' : tab.isProfile ? '📝 My Profile Info' : '➕ Add New Entry'}
            </h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              <span className="text-red-500">*</span> Required
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tab.fields.map(field => (
                <div key={field.key}
                  className={['textarea', 'file', 'url'].includes(field.type) ? 'md:col-span-2' : ''}>
                  <DynamicField
                    field={field} register={register}
                    watch={watch} setValue={setValue} errors={errors}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button id="tab-form-submit" type="submit" className="btn-primary" disabled={saving}>
                {saving ? '⏳ Saving…' : editing ? '💾 Update' : '💾 Save'}
              </button>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                or <kbd className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono text-xs">Ctrl+S</kbd>
              </span>
              {!tab.isProfile && (
                <button type="button" onClick={cancelForm} className="btn-secondary ml-auto">Cancel</button>
              )}
            </div>
          </form>

          {/* Timestamps for profile tab */}
          {tab.isProfile && records[0] && (
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 space-y-0.5">
              <p>📅 Created: {formatDate(records[0].createdAt)}</p>
              <p>🔄 Last updated: {formatDate(records[0].updatedAt || records[0].createdAt)}</p>
            </div>
          )}
        </div>
      )}

      {/* Add button */}
      {!tab.isProfile && !showForm && (
        <button onClick={() => { setEditing(null); reset(); setShowForm(true) }} className="btn-primary mb-6">
          ➕ Add New Entry
        </button>
      )}

      {/* Records table */}
      {!tab.isProfile && (
        <div className="card">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">
            My Entries ({records.length})
          </h2>

          {loading ? (
            <div className="text-center py-10 text-gray-400 dark:text-gray-500">
              <div className="w-8 h-8 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading from repository…
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-gray-500">
              <p className="text-3xl mb-2">📭</p>
              <p>No entries yet. Add your first one above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    {previewFields.map(f => (
                      <th key={f.key} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Added</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {records.map((row, idx) => (
                    <tr key={row.id}
                      className={`border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50
                        ${idx % 2 === 1 ? 'bg-gray-50/40 dark:bg-gray-800/40' : ''}`}>
                      {previewFields.map(f => (
                        <td key={f.key} className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[160px] truncate"
                          title={String(row[f.key] ?? '')}>
                          {row[f.key] ?? <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-3 py-2 text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(row.updatedAt)}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-3">
                          <button onClick={() => startEdit(row)}
                            className="text-pdeu-blue hover:underline text-xs dark:text-blue-400">Edit</button>
                          <button onClick={() => handleDelete(row.id)}
                            className="text-red-400 hover:underline text-xs">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
