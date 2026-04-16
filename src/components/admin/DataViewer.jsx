import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { getAllRecordsForTab, adminDeleteRecord, getAllFaculties, updateRecord, toggleVerified } from '../../lib/github'
import { getTab, ACADEMIC_YEARS, SDG_LIST } from '../../config/tabs'
import { exportToExcel } from '../../utils/exportExcel'
import DynamicField from '../common/DynamicField'
import ProofDownloader from './ProofDownloader'
import toast from 'react-hot-toast'
import { openProofInBrowser } from '../../lib/filestore'

// Import SDG_LIST if not exported from tabs — define inline fallback
const SDG_NAMES = Object.fromEntries(
  (typeof SDG_LIST !== 'undefined' ? SDG_LIST : [
    {num:1,label:'No Poverty'},{num:2,label:'Zero Hunger'},{num:3,label:'Good Health'},
    {num:4,label:'Quality Education'},{num:5,label:'Gender Equality'},{num:6,label:'Clean Water'},
    {num:7,label:'Clean Energy'},{num:8,label:'Decent Work'},{num:9,label:'Industry & Innovation'},
    {num:10,label:'Reduced Inequalities'},{num:11,label:'Sustainable Cities'},
    {num:12,label:'Responsible Consumption'},{num:13,label:'Climate Action'},
    {num:14,label:'Life Below Water'},{num:15,label:'Life on Land'},
    {num:16,label:'Peace & Justice'},{num:17,label:'Partnerships'},
  ]).map(s => [s.num, s.label])
)

function expandSDG(val) {
  if (!val) return ''
  return String(val).split(',').map(n => {
    const num = parseInt(n.trim())
    return isNaN(num) ? n : `SDG${num}-${SDG_NAMES[num] || num}`
  }).join(', ')
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
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
  const [verifiedFilter,setVerifiedFilter]= useState('all')  // all | verified | unverified
  const [expandedRow,   setExpandedRow]   = useState(null)
  const [editingRow,    setEditingRow]    = useState(null)
  const [saving,        setSaving]        = useState(false)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm()

  useEffect(() => { if (tab) fetchAll() }, [tabId])

  useEffect(() => {
    if (!editingRow) return
    const fn = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        document.getElementById('admin-edit-submit')?.click()
      }
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [editingRow])

  async function fetchAll() {
    setLoading(true)
    try {
      const [data, fList] = await Promise.all([getAllRecordsForTab(tab.id), getAllFaculties()])
      setRows(data); setFaculties(fList)
    } catch (e) { toast.error('Failed to load: ' + e.message) }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    let r = rows
    if (search) { const q = search.toLowerCase(); r = r.filter(row => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))) }
    if (yearFilter)     r = r.filter(row => String(row.academic_year ?? '').includes(yearFilter))
    if (facultyFilter)  r = r.filter(row => row.facultyName === facultyFilter)
    if (verifiedFilter === 'verified')   r = r.filter(row => row._verified)
    if (verifiedFilter === 'unverified') r = r.filter(row => !row._verified)
    return r
  }, [rows, search, yearFilter, facultyFilter, verifiedFilter])

  const facultyNames = useMemo(() =>
    [...new Set(rows.map(r => r.facultyName).filter(Boolean))].sort(), [rows])

  const displayFields = useMemo(() => {
    if (!tab) return []
    return [
      { key: 'facultyName', label: 'Faculty Name', type: 'text' },
      ...tab.fields.filter(f => !['file','boolean','proof_upload','sdg_multi'].includes(f.type)).slice(0, 4),
    ]
  }, [tab])

  async function quickExport() {
    if (!filtered.length) { toast.error('No data to export'); return }
    const cols = [
      { key: 'facultyName', label: 'Faculty Name' },
      ...tab.fields.map(f => ({
        key: f.key, label: f.label,
        // Expand SDG numbers to names in export
        transform: f.key === 'sdg_goals' ? expandSDG : undefined,
      })),
      { key: 'createdAt', label: 'Date Added' },
      { key: 'updatedAt', label: 'Last Updated' },
      { key: '_verified', label: 'Verified by Admin' },
    ]
    // Pre-process rows to expand SDG
    const processedRows = filtered.map(row => ({
      ...row,
      sdg_goals: expandSDG(row.sdg_goals),
      _verified: row._verified ? 'Yes' : 'No',
    }))
    await exportToExcel(processedRows, cols, tab.name, `${tab.number}_${tab.name.replace(/\s+/g,'_')}`)
    toast.success('Downloaded!')
  }

  function startEdit(row) {
    const faculty = faculties.find(f => f.fullName === row.facultyName)
    setEditingRow({ row, userId: faculty?.id })
    reset(row); setExpandedRow(null)
  }

  async function onEditSubmit(values) {
    if (!editingRow) return
    setSaving(true)
    try {
      await updateRecord(tab.id, editingRow.userId, editingRow.row.id, values)
      await fetchAll(); setEditingRow(null); reset()
      toast.success('Record updated!')
    } catch (e) { toast.error('Update failed: ' + e.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(row) {
    if (!confirm(`Delete this record by ${row.facultyName}? Cannot be undone.`)) return
    const faculty = faculties.find(f => f.fullName === row.facultyName)
    if (!faculty) { toast.error('Cannot identify faculty owner'); return }
    try {
      await adminDeleteRecord(tab.id, faculty.id, row.id)
      setRows(prev => prev.filter(r => r.id !== row.id))
      toast.success('Deleted')
    } catch (e) { toast.error(e.message) }
  }

  async function handleVerify(row, verified) {
    const faculty = faculties.find(f => f.fullName === row.facultyName)
    if (!faculty) { toast.error('Cannot identify faculty owner'); return }
    try {
      await toggleVerified(tab.id, faculty.id, row.id, verified)
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, _verified: verified } : r))
      toast.success(verified ? '✅ Marked as verified' : 'Marked as unverified')
    } catch (e) { toast.error(e.message) }
  }

  if (!tab) return <div className="p-8 text-gray-500 dark:text-gray-400">Tab not found.</div>

  const verifiedCount   = rows.filter(r => r._verified).length
  const unverifiedCount = rows.length - verifiedCount

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to="/admin" className="text-gray-400 hover:text-pdeu-blue text-sm">← Dashboard</Link>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <h1 className="text-xl font-bold text-pdeu-blue dark:text-white">{tab.icon} {tab.name}</h1>
        <div className="ml-auto flex gap-2">
          <Link to="/admin/export" className="btn-secondary text-sm">🛠 Custom Export</Link>
          <button onClick={quickExport} className="btn-primary text-sm">📥 Quick Export</button>
        </div>
      </div>

      {/* Verification summary */}
      {rows.length > 0 && (
        <div className="flex gap-3 mb-4 flex-wrap">
          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1.5 rounded-full font-medium">
            ✅ {verifiedCount} verified
          </span>
          <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full font-medium">
            ⏳ {unverifiedCount} pending review
          </span>
        </div>
      )}

      {/* Admin edit form */}
      {editingRow && (
        <div className="card mb-6 border-2 border-amber-300 dark:border-amber-500">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">
              ✏️ Editing: <span className="text-pdeu-blue">{editingRow.row.facultyName}</span>
            </h2>
            <p className="text-xs text-gray-400"><span className="text-red-500">*</span> Required</p>
          </div>
          <form onSubmit={handleSubmit(onEditSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tab.fields.map(field => (
                <div key={field.key} className={['textarea','file','url','proof_upload'].includes(field.type) ? 'md:col-span-2' : ''}>
                  <DynamicField field={field} register={register} watch={watch} setValue={setValue} errors={errors} tab={{ ...tab, _userId: editingRow?.userId, _facultyName: editingRow?.row?.facultyName, _watchValues: watch() }} />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
              <button id="admin-edit-submit" type="submit" className="btn-primary" disabled={saving}>{saving ? '⏳ Saving…' : '💾 Save Changes'}</button>
              <button type="button" className="btn-secondary" onClick={() => { setEditingRow(null); reset() }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
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
        <select value={verifiedFilter} onChange={e => setVerifiedFilter(e.target.value)} className="form-input max-w-[160px]">
          <option value="all">All Records</option>
          <option value="verified">Verified only</option>
          <option value="unverified">Pending review</option>
        </select>
        <span className="self-center text-sm text-gray-500 dark:text-gray-400">
          {filtered.length} / {rows.length} records
        </span>
      </div>

      {/* Proof + ZIP downloader */}
      {filtered.length > 0 && (
        <ProofDownloader rows={filtered} columns={[
          { key: 'facultyName', label: 'Faculty Name' },
          ...tab.fields.map(f => ({ key: f.key === 'sdg_goals' ? '__sdg__' : f.key, label: f.label })),
          { key: 'createdAt', label: 'Date Added' },
          { key: '_verified', label: 'Verified' },
        ]} tab={tab}
        label={`${tab.number}_${tab.name}${yearFilter ? '_'+yearFilter : ''}${facultyFilter ? '_'+facultyFilter.split(' ').pop() : ''}`} />
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">
          <div className="w-8 h-8 border-2 border-pdeu-blue border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading from repository…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400 dark:text-gray-500">
          <p className="text-4xl mb-3">📭</p>
          <p>No records{search || yearFilter || facultyFilter ? ' matching filters' : ' yet'}.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden mt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-pdeu-light dark:bg-gray-700 sticky top-0 z-10">
                <tr>
                  {displayFields.map(f => (
                    <th key={f.key} className="table-header">{f.label}</th>
                  ))}
                  <th className="table-header">Updated</th>
                  <th className="table-header">Status</th>
                  <th className="px-4 py-3 w-36" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => (
                  <>
                    <tr key={row.id}
                      className={`border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50/20 dark:hover:bg-gray-700/40
                        ${idx % 2 === 1 ? 'bg-gray-50/40 dark:bg-gray-800/40' : ''}`}>
                      {displayFields.map(f => (
                        <td key={f.key} className="table-cell" title={String(row[f.key] ?? '')}>
                          {row[f.key] != null && row[f.key] !== ''
                            ? String(row[f.key])
                            : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-gray-400 dark:text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(row.updatedAt || row.createdAt)}
                      </td>
                      {/* Verified badge */}
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => handleVerify(row, !row._verified)}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors cursor-pointer
                            ${row._verified
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200'
                              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200'
                            }`}
                          title={row._verified
                            ? `Verified${row._verifiedAt ? ' on ' + formatDate(row._verifiedAt) : ''} — click to unverify`
                            : 'Click to mark as verified'
                          }
                        >
                          {row._verified ? '✅ Verified' : '⏳ Pending'}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                            className="text-xs text-gray-400 hover:text-pdeu-blue dark:hover:text-blue-400">
                            {expandedRow === row.id ? '▲' : '▼'}
                          </button>
                          <button onClick={() => startEdit(row)} className="text-xs text-pdeu-blue hover:underline">Edit</button>
                          <button onClick={() => handleDelete(row)} className="text-xs text-red-400 hover:underline">Del</button>
                        </div>
                      </td>
                    </tr>

                    {expandedRow === row.id && (
                      <tr key={`${row.id}_exp`}>
                        <td colSpan={displayFields.length + 3}
                          className="px-6 py-4 bg-blue-50/20 dark:bg-gray-700/30 border-b border-blue-100 dark:border-gray-700">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {tab.fields.map(f => (
                              <div key={f.key}>
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{f.label}</p>
                                <p className="text-sm text-gray-800 dark:text-gray-200 mt-0.5 break-words">
                                  {f.key === 'sdg_goals' && row[f.key]
                                    ? <span className="text-pdeu-blue dark:text-blue-400">{expandSDG(row[f.key])}</span>
                                    : f.type === 'proof_upload' && row[f.key]
                                    ? <button
                                        type="button"
                                        onClick={() => openProofInBrowser(row[f.key]).catch(e => toast.error('Could not open PDF: ' + e.message))}
                                        className="text-green-600 dark:text-green-400 text-xs font-mono hover:underline"
                                      >✅ {row.report_name || row[f.key].split('/').pop()} · View PDF</button>
                                    : (row[f.key] != null && row[f.key] !== ''
                                        ? String(row[f.key])
                                        : <span className="text-gray-300 dark:text-gray-600">—</span>)
                                  }
                                </p>
                              </div>
                            ))}
                            {/* Audit trail */}
                            <div className="md:col-span-2">
                              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Audit Trail</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Created: {formatDate(row.createdAt)}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Updated: {formatDate(row.updatedAt)}</p>
                              {row._changedFields?.length > 0 && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                                  Last edit changed: {row._changedFields.join(', ')}
                                </p>
                              )}
                              {row._verified && (
                                <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                                  Verified: {formatDate(row._verifiedAt)}
                                </p>
                              )}
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
