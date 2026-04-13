import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { getAllRecordsForTab, adminDeleteRecord, getAllFaculties, updateRecord } from '../../lib/github'
import { getTab, ACADEMIC_YEARS } from '../../config/tabs'
import { exportToExcel } from '../../utils/exportExcel'
import DynamicField from '../common/DynamicField'
import toast from 'react-hot-toast'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function DataViewer() {
  const { tabId } = useParams()
  const tab       = getTab(tabId)

  const [rows,          setRows]          = useState([])
  const [faculties,     setFaculties]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [yearFilter,    setYearFilter]    = useState('')
  const [facultyFilter, setFacultyFilter] = useState('')
  const [expandedRow,   setExpandedRow]   = useState(null)
  const [editingRow,    setEditingRow]    = useState(null)  // { row, userId }
  const [saving,        setSaving]        = useState(false)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm()

  useEffect(() => { if (tab) fetchAll() }, [tabId])

  async function fetchAll() {
    setLoading(true)
    try {
      const [data, fList] = await Promise.all([
        getAllRecordsForTab(tab.id),
        getAllFaculties(),
      ])
      setRows(data)
      setFaculties(fList)
    } catch (e) {
      toast.error('Failed to load: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    let r = rows
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(row => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)))
    }
    if (yearFilter)    r = r.filter(row => String(row.academic_year ?? '').includes(yearFilter))
    if (facultyFilter) r = r.filter(row => row.facultyName === facultyFilter)
    return r
  }, [rows, search, yearFilter, facultyFilter])

  const facultyNames = useMemo(() =>
    [...new Set(rows.map(r => r.facultyName).filter(Boolean))].sort(), [rows])

  const displayFields = useMemo(() => {
    if (!tab) return []
    return [
      { key: 'facultyName', label: 'Faculty Name', type: 'text' },
      ...tab.fields.filter(f => !['file', 'boolean'].includes(f.type)).slice(0, 4),
    ]
  }, [tab])

  async function quickExport() {
    if (!filtered.length) { toast.error('No data to export'); return }
    const cols = [
      { key: 'facultyName', label: 'Faculty Name' },
      ...tab.fields.map(f => ({ key: f.key, label: f.label })),
      { key: 'createdAt', label: 'Date Added' },
      { key: 'updatedAt', label: 'Last Updated' },
    ]
    await exportToExcel(filtered, cols, tab.name, `${tab.number}_${tab.name.replace(/\s+/g, '_')}`)
    toast.success('Downloaded!')
  }

  function startEdit(row) {
    // Find which faculty owns this row
    const faculty = faculties.find(f => f.fullName === row.facultyName)
    setEditingRow({ row, userId: faculty?.id })
    reset(row)
    setExpandedRow(null)
  }

  async function onEditSubmit(values) {
    if (!editingRow) return
    setSaving(true)
    try {
      const updated = await updateRecord(tab.id, editingRow.userId, editingRow.row.id, values)
      // Refresh rows
      await fetchAll()
      setEditingRow(null)
      reset()
      toast.success('Record updated!')
    } catch (e) {
      toast.error('Update failed: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(row) {
    if (!confirm(`Delete this record by ${row.facultyName}? This cannot be undone.`)) return
    const faculty = faculties.find(f => f.fullName === row.facultyName)
    if (!faculty) { toast.error('Could not identify faculty owner'); return }
    try {
      await adminDeleteRecord(tab.id, faculty.id, row.id)
      setRows(prev => prev.filter(r => r.id !== row.id))
      toast.success('Record deleted')
    } catch (e) {
      toast.error('Delete failed: ' + e.message)
    }
  }

  if (!tab) return <div className="p-8 text-gray-500">Tab not found.</div>

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to="/admin" className="text-gray-400 hover:text-pdeu-blue text-sm">← Dashboard</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-pdeu-blue">{tab.icon} {tab.name}</h1>
        <div className="ml-auto flex gap-2">
          <Link to="/admin/export" className="btn-secondary text-sm">🛠 Custom Export</Link>
          <button onClick={quickExport} className="btn-primary text-sm">📥 Quick Export</button>
        </div>
      </div>

      {/* Admin edit form */}
      {editingRow && (
        <div className="card mb-6 border-2 border-amber-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">
              ✏️ Editing record by <span className="text-pdeu-blue">{editingRow.row.facultyName}</span>
            </h2>
            <p className="text-xs text-gray-400"><span className="text-red-500">*</span> Required fields</p>
          </div>
          <form onSubmit={handleSubmit(onEditSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tab.fields.map(field => (
                <div key={field.key} className={['textarea','file','url'].includes(field.type) ? 'md:col-span-2' : ''}>
                  <DynamicField field={field} register={register} watch={watch} setValue={setValue} errors={errors} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? '⏳ Saving…' : '💾 Save Changes'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => { setEditingRow(null); reset() }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input type="text" placeholder="Search all columns…" value={search}
          onChange={e => setSearch(e.target.value)} className="form-input max-w-xs" />
        <select value={facultyFilter} onChange={e => setFacultyFilter(e.target.value)} className="form-input max-w-[220px]">
          <option value="">All Faculties</option>
          {facultyNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="form-input max-w-[160px]">
          <option value="">All Years</option>
          {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="self-center text-sm text-gray-500">{filtered.length} / {rows.length} records</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-20 text-gray-400">
          <div className="w-8 h-8 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading from repository…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p>No records{search || yearFilter || facultyFilter ? ' matching filters' : ' yet'}.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-pdeu-light sticky top-0 z-10">
                <tr>
                  {displayFields.map(f => (
                    <th key={f.key} className="text-left px-4 py-3 text-xs font-semibold text-pdeu-blue uppercase tracking-wide whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-pdeu-blue uppercase tracking-wide whitespace-nowrap">Added</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-pdeu-blue uppercase tracking-wide whitespace-nowrap">Updated</th>
                  <th className="px-4 py-3 w-28" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => (
                  <>
                    <tr key={row.id}
                      className={`border-b border-gray-50 hover:bg-blue-50/30 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}
                    >
                      {displayFields.map(f => (
                        <td key={f.key} className="px-4 py-2.5 text-gray-700 max-w-[180px] truncate" title={String(row[f.key] ?? '')}>
                          {row[f.key] != null && row[f.key] !== '' ? String(row[f.key]) : <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">{formatDate(row.updatedAt)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                            className="text-xs text-gray-400 hover:text-pdeu-blue"
                          >
                            {expandedRow === row.id ? '▲ Less' : '▼ More'}
                          </button>
                          <button onClick={() => startEdit(row)} className="text-xs text-pdeu-blue hover:underline">Edit</button>
                          <button onClick={() => handleDelete(row)} className="text-xs text-red-400 hover:underline">Del</button>
                        </div>
                      </td>
                    </tr>

                    {expandedRow === row.id && (
                      <tr key={`${row.id}_exp`}>
                        <td colSpan={displayFields.length + 3} className="px-6 py-4 bg-blue-50/20 border-b border-blue-100">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {tab.fields.map(f => (
                              <div key={f.key}>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{f.label}</p>
                                <p className="text-sm text-gray-800 mt-0.5 break-words">
                                  {f.type === 'file' && row[f.key]
                                    ? <a href={row[f.key]} target="_blank" rel="noreferrer" className="text-pdeu-blue underline">View File ↗</a>
                                    : (row[f.key] != null && row[f.key] !== '' ? String(row[f.key]) : <span className="text-gray-300">—</span>)
                                  }
                                </p>
                              </div>
                            ))}
                            <div className="md:col-span-2">
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Audit Trail</p>
                              <p className="text-xs text-gray-500 mt-0.5">Created: {formatDate(row.createdAt)}</p>
                              <p className="text-xs text-gray-500">Last updated: {formatDate(row.updatedAt)}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
