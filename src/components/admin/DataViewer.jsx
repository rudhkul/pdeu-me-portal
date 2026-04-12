import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getAllRecordsForTab } from '../../lib/github'
import { getTab, ACADEMIC_YEARS } from '../../config/tabs'
import { exportToExcel } from '../../utils/exportExcel'
import toast from 'react-hot-toast'

export default function DataViewer() {
  const { tabId } = useParams()
  const tab       = getTab(tabId)

  const [rows,        setRows]        = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [yearFilter,  setYearFilter]  = useState('')
  const [facultyFilter, setFacultyFilter] = useState('')
  const [expandedRow, setExpandedRow] = useState(null)

  useEffect(() => { if (tab) fetch() }, [tabId])

  async function fetch() {
    setLoading(true)
    try {
      const data = await getAllRecordsForTab(tab.id)
      setRows(data)
    } catch (e) {
      toast.error('Failed to load: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  // Unique faculty names for filter dropdown
  const facultyNames = useMemo(() =>
    [...new Set(rows.map(r => r.facultyName).filter(Boolean))].sort(),
    [rows]
  )

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

  const displayFields = useMemo(() => {
    if (!tab) return []
    const dataFields = tab.fields.filter(f => !['file', 'boolean'].includes(f.type)).slice(0, 5)
    return [{ key: 'facultyName', label: 'Faculty Name', type: 'text' }, ...dataFields]
  }, [tab])

  async function quickExport() {
    if (!filtered.length) { toast.error('No data to export'); return }
    const cols = [
      { key: 'facultyName', label: 'Faculty Name' },
      ...tab.fields.map(f => ({ key: f.key, label: f.label })),
      { key: 'createdAt', label: 'Date Added' },
    ]
    await exportToExcel(filtered, cols, tab.name, `${tab.number}_${tab.name.replace(/\s+/g, '_')}`)
    toast.success('Downloaded!')
  }

  if (!tab) return <div className="p-8 text-gray-500">Tab not found.</div>

  return (
    <div className="p-6 max-w-full">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link to="/admin" className="text-gray-400 hover:text-pdeu-blue text-sm">← Dashboard</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-pdeu-blue">{tab.icon} {tab.name}</h1>
        <div className="ml-auto flex gap-2">
          <Link to="/admin/export" className="btn-secondary text-sm">🛠 Custom Export</Link>
          <button onClick={quickExport} className="btn-primary text-sm">📥 Quick Export All</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="text"
          placeholder="Search all columns…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="form-input max-w-xs"
        />
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
          <p>No records{search || yearFilter || facultyFilter ? ' matching your filters' : ' yet'}.</p>
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-pdeu-blue uppercase tracking-wide">Added</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => (
                  <>
                    <tr
                      key={row.id}
                      onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                      className={`border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}
                    >
                      {displayFields.map(f => (
                        <td key={f.key} className="px-4 py-2.5 text-gray-700 max-w-[200px] truncate" title={String(row[f.key] ?? '')}>
                          {row[f.key] != null && row[f.key] !== ''
                            ? String(row[f.key])
                            : <span className="text-gray-300">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-2.5 text-gray-400 text-xs whitespace-nowrap">
                        {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{expandedRow === row.id ? '▲' : '▼'}</td>
                    </tr>

                    {expandedRow === row.id && (
                      <tr key={`${row.id}_exp`}>
                        <td colSpan={displayFields.length + 2} className="px-6 py-4 bg-blue-50/20 border-b border-blue-100">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {tab.fields.map(f => (
                              <div key={f.key}>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{f.label}</p>
                                <p className="text-sm text-gray-800 mt-0.5 break-words">
                                  {f.type === 'file' && row[f.key]
                                    ? <a href={row[f.key]} target="_blank" rel="noreferrer" className="text-pdeu-blue underline" onClick={e => e.stopPropagation()}>View File ↗</a>
                                    : (row[f.key] != null && row[f.key] !== '' ? String(row[f.key]) : <span className="text-gray-300">—</span>)}
                                </p>
                              </div>
                            ))}
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
