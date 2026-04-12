import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../../hooks/useAuth'
import { getTab, TABS } from '../../config/tabs'
import {
  getFacultyRecords,
  addRecord,
  updateRecord,
  deleteRecord,
  saveFacultyRecords,
} from '../../lib/github'
import DynamicField from '../common/DynamicField'
import toast from 'react-hot-toast'

export default function TabForm() {
  const { tabId }    = useParams()
  const { session }  = useAuth()
  const tab          = getTab(tabId)

  const [records,  setRecords]  = useState([])
  const [editing,  setEditing]  = useState(null)   // record id being edited
  const [showForm, setShowForm] = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm()

  useEffect(() => {
    if (tab) fetchRecords()
  }, [tabId])

  async function fetchRecords() {
    setLoading(true)
    try {
      const data = await getFacultyRecords(tab.id, session.userId)
      setRecords(data)
      // For profile tabs: pre-fill form if a record exists
      if (tab.isProfile && data.length > 0) reset(data[0])
    } catch (e) {
      toast.error('Failed to load records: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function onSubmit(values) {
    setSaving(true)
    try {
      const payload = { ...values, facultyName: session.fullName }

      if (tab.isProfile) {
        // Upsert: one record per faculty
        const current = records[0]
        if (current) {
          const updated = await updateRecord(tab.id, session.userId, current.id, payload)
          setRecords(updated)
        } else {
          const updated = await addRecord(tab.id, session.userId, payload)
          setRecords(updated)
        }
        toast.success('Profile saved!')
      } else if (editing) {
        const updated = await updateRecord(tab.id, session.userId, editing, payload)
        setRecords(updated)
        setEditing(null)
        setShowForm(false)
        reset()
        toast.success('Record updated!')
      } else {
        const updated = await addRecord(tab.id, session.userId, payload)
        setRecords(updated)
        setShowForm(false)
        reset()
        toast.success('Record saved!')
      }
    } catch (e) {
      toast.error('Save failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(row) {
    setEditing(row.id)
    reset(row)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id) {
    if (!confirm('Delete this record? This cannot be undone.')) return
    try {
      const updated = await deleteRecord(tab.id, session.userId, id)
      setRecords(updated)
      toast.success('Deleted')
    } catch (e) {
      toast.error('Delete failed: ' + e.message)
    }
  }

  function cancelForm() {
    reset()
    setEditing(null)
    setShowForm(false)
  }

  if (!tab) return <div className="p-8 text-center text-gray-500">Tab not found.</div>

  // Preview columns for the table (first 5 non-bulky fields)
  const previewFields = tab.fields
    .filter(f => !['file', 'textarea', 'boolean'].includes(f.type))
    .slice(0, 5)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link to="/faculty" className="text-gray-400 hover:text-pdeu-blue">← Dashboard</Link>
        <span className="text-gray-300">/</span>
        <h1 className="font-bold text-pdeu-blue flex items-center gap-2 text-lg">
          {tab.icon} {tab.name}
        </h1>
      </div>

      {/* GitHub API note */}
      {saving && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-sm text-blue-700 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          Saving to repository… this may take a few seconds.
        </div>
      )}

      {/* Form (profile tabs always show, others toggle) */}
      {(showForm || tab.isProfile) && (
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">
            {editing ? '✏️ Edit Record' : tab.isProfile ? '📝 My Profile Info' : '➕ Add New Entry'}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tab.fields.map(field => (
                <div
                  key={field.key}
                  className={['textarea', 'file', 'url'].includes(field.type) ? 'md:col-span-2' : ''}
                >
                  <DynamicField
                    field={field}
                    register={register}
                    watch={watch}
                    setValue={setValue}
                    errors={errors}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? '⏳ Saving…' : editing ? '💾 Update' : '💾 Save'}
              </button>
              {!tab.isProfile && (
                <button type="button" onClick={cancelForm} className="btn-secondary">Cancel</button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Add button for multi-record tabs */}
      {!tab.isProfile && !showForm && (
        <button onClick={() => { setEditing(null); reset(); setShowForm(true) }} className="btn-primary mb-6">
          ➕ Add New Entry
        </button>
      )}

      {/* Records Table */}
      {!tab.isProfile && (
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">My Entries ({records.length})</h2>

          {loading ? (
            <div className="text-center py-10 text-gray-400">
              <div className="w-8 h-8 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              Loading from repository…
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <p className="text-3xl mb-2">📭</p>
              <p>No entries yet. Add your first one above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {previewFields.map(f => (
                      <th key={f.key} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">Added</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {records.map(row => (
                    <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                      {previewFields.map(f => (
                        <td key={f.key} className="px-3 py-2 text-gray-700 max-w-[180px] truncate" title={String(row[f.key] ?? '')}>
                          {row[f.key] ?? <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-3">
                          <button onClick={() => startEdit(row)} className="text-pdeu-blue hover:underline text-xs">Edit</button>
                          <button onClick={() => handleDelete(row.id)} className="text-red-400 hover:underline text-xs">Delete</button>
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
