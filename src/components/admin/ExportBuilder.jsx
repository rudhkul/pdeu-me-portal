import { useState, useEffect, useMemo } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getAllRecordsForTab, getAllFaculties } from '../../lib/github'
import { TABS, ACADEMIC_YEARS, getTab } from '../../config/tabs'
import { exportToExcel, exportMultiSheet } from '../../utils/exportExcel'
import toast from 'react-hot-toast'

function SortableColumn({ id, label, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 bg-white border rounded-lg px-3 py-2 text-sm shadow-sm select-none
        ${isDragging ? 'opacity-50 border-pdeu-blue shadow-lg' : 'border-gray-200'}`}
    >
      <span {...attributes} {...listeners} className="text-gray-300 cursor-grab active:cursor-grabbing">⠿</span>
      <span className="flex-1 text-gray-700 truncate max-w-[200px]">{label}</span>
      <button onClick={() => onRemove(id)} className="text-gray-300 hover:text-red-400 flex-shrink-0 text-xs">✕</button>
    </div>
  )
}

export default function ExportBuilder() {
  const [selectedTab,    setSelectedTab]    = useState(TABS[0].id)
  const [yearFilter,     setYearFilter]     = useState('')
  const [facultyFilter,  setFacultyFilter]  = useState('')
  const [faculties,      setFaculties]      = useState([])
  const [rows,           setRows]           = useState([])
  const [loading,        setLoading]        = useState(false)
  const [exportingAll,   setExportingAll]   = useState(false)
  const [previewReady,   setPreviewReady]   = useState(false)

  const tab     = getTab(selectedTab)
  const allCols = useMemo(() => [
    { key: 'facultyName', label: 'Faculty Name' },
    ...tab.fields.map(f => ({ key: f.key, label: f.label })),
    { key: 'createdAt', label: 'Date Added' },
    { key: 'updatedAt', label: 'Last Updated' },
  ], [selectedTab])

  const [chosen, setChosen] = useState(allCols)
  const chosenKeys = chosen.map(c => c.key)
  const available  = allCols.filter(c => !chosenKeys.includes(c.key))

  useEffect(() => { setChosen(allCols); setPreviewReady(false); setRows([]) }, [selectedTab])
  useEffect(() => { getAllFaculties().then(setFaculties).catch(() => {}) }, [])

  const sensors = useSensors(useSensor(PointerSensor))

  function handleDragEnd({ active, over }) {
    if (active.id !== over?.id) {
      setChosen(prev => arrayMove(
        prev,
        prev.findIndex(c => c.key === active.id),
        prev.findIndex(c => c.key === over.id)
      ))
    }
  }

  async function loadPreview() {
    if (!chosen.length) { toast.error('Select at least one column'); return }
    setLoading(true)
    try {
      let data = await getAllRecordsForTab(tab.id)
      if (facultyFilter) data = data.filter(r => r.facultyName === facultyFilter)
      if (yearFilter)    data = data.filter(r => String(r.academic_year ?? '').includes(yearFilter))
      setRows(data)
      setPreviewReady(true)
      toast.success(`Loaded ${data.length} records`)
    } catch (e) {
      toast.error('Failed to load: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  async function doExport() {
    if (!rows.length) { toast.error('Load data first'); return }
    await exportToExcel(
      rows, chosen, tab.name,
      `${tab.number}_${tab.name.replace(/\s+/g, '_')}_${yearFilter || 'AllYears'}`
    )
    toast.success('Excel downloaded!')
  }

  // ── Export ALL tabs as one multi-sheet Excel ──────────────────
  async function exportAllTabs() {
    if (!confirm(`This will download ALL ${TABS.length} tabs as one Excel file. It may take 1–2 minutes. Continue?`)) return
    setExportingAll(true)
    toast('Fetching all tab data… please wait.', { icon: '⏳', duration: 60000, id: 'exportall' })
    try {
      const sheets = []
      for (const t of TABS) {
        let data = await getAllRecordsForTab(t.id)
        if (facultyFilter) data = data.filter(r => r.facultyName === facultyFilter)
        if (yearFilter)    data = data.filter(r => String(r.academic_year ?? '').includes(yearFilter))
        const cols = [
          { key: 'facultyName', label: 'Faculty Name' },
          ...t.fields.map(f => ({ key: f.key, label: f.label })),
          { key: 'createdAt', label: 'Date Added' },
          { key: 'updatedAt', label: 'Last Updated' },
        ]
        sheets.push({ rows: data, columns: cols, sheetName: `${t.number}. ${t.name}` })
      }
      await exportMultiSheet(sheets)
      toast.success('All tabs exported!', { id: 'exportall' })
    } catch (e) {
      toast.error('Export failed: ' + e.message, { id: 'exportall' })
    } finally {
      setExportingAll(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-pdeu-blue mb-1">📥 Export Builder</h1>
      <p className="text-gray-500 text-sm mb-8">Choose a tab, pick and reorder columns, filter, then download as Excel.</p>

      {/* Export All button */}
      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-gray-800">Export All Tabs at Once</p>
          <p className="text-sm text-gray-500 mt-0.5">
            Downloads all {TABS.length} tabs as a single Excel file with one sheet per tab.
            Filters below (faculty / year) also apply.
          </p>
        </div>
        <button
          onClick={exportAllTabs}
          disabled={exportingAll}
          className="btn-primary flex items-center gap-2 whitespace-nowrap"
        >
          {exportingAll
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>Exporting…</>
            : '📊 Export All Tabs'
          }
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left panel */}
        <div className="space-y-5">
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-3">1. Select Tab</h2>
            <select value={selectedTab} onChange={e => setSelectedTab(e.target.value)} className="form-input">
              {TABS.map(t => <option key={t.id} value={t.id}>{t.number}. {t.name}</option>)}
            </select>
          </div>

          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-3">2. Apply Filters <span className="text-xs font-normal text-gray-400">(also applies to Export All)</span></h2>
            <div className="space-y-3">
              <div>
                <label className="form-label">Faculty Name</label>
                <select value={facultyFilter} onChange={e => setFacultyFilter(e.target.value)} className="form-input">
                  <option value="">All Faculties</option>
                  {faculties.map(f => <option key={f.id} value={f.fullName}>{f.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Academic Year</label>
                <select value={yearFilter} onChange={e => setYearFilter(e.target.value)} className="form-input">
                  <option value="">All Years</option>
                  {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">3. Add Columns</h2>
              <button onClick={() => setChosen(allCols)} className="text-xs text-pdeu-blue hover:underline">Add all</button>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {available.length === 0
                ? <p className="text-xs text-gray-400 text-center py-3">All columns added ✓</p>
                : available.map(col => (
                    <button key={col.key} onClick={() => setChosen(p => [...p, col])}
                      className="w-full text-left px-3 py-1.5 text-sm text-gray-600 hover:bg-pdeu-light hover:text-pdeu-blue rounded-lg">
                      + {col.label}
                    </button>
                  ))
              }
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="xl:col-span-2 space-y-5">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold text-gray-800">4. Order Columns</h2>
                <p className="text-xs text-gray-400 mt-0.5">Drag to reorder · {chosen.length} selected</p>
              </div>
              <button onClick={() => setChosen([])} className="text-xs text-red-400 hover:underline">Clear all</button>
            </div>

            {chosen.length === 0 ? (
              <div className="text-center py-8 text-gray-300 border-2 border-dashed rounded-xl">Add columns from the left panel</div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={chosen.map(c => c.key)} strategy={verticalListSortingStrategy}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                    {chosen.map((col, i) => (
                      <div key={col.key} className="flex items-center gap-2">
                        <span className="text-xs text-gray-300 w-5 text-right">{i + 1}</span>
                        <SortableColumn id={col.key} label={col.label} onRemove={k => setChosen(p => p.filter(c => c.key !== k))} />
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={loadPreview} className="btn-secondary" disabled={loading}>
              {loading ? '⏳ Loading…' : '👁 Load Preview'}
            </button>
            <button onClick={doExport} className="btn-primary" disabled={!previewReady || !rows.length}>
              📥 Download Excel ({rows.length} rows)
            </button>
          </div>

          {previewReady && rows.length > 0 && (
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <p className="font-semibold text-gray-800 text-sm">Preview — first 10 rows</p>
                <p className="text-xs text-gray-400">{rows.length} total rows in export</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-pdeu-light">
                    <tr>
                      {chosen.map(c => (
                        <th key={c.key} className="text-left px-3 py-2 text-pdeu-blue font-semibold uppercase tracking-wide whitespace-nowrap">{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 10).map((row, i) => (
                      <tr key={i} className={`border-b border-gray-50 ${i % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                        {chosen.map(c => (
                          <td key={c.key} className="px-3 py-2 text-gray-600 max-w-[160px] truncate">
                            {row[c.key] != null && row[c.key] !== '' ? String(row[c.key]) : <span className="text-gray-300">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 10 && (
                  <p className="text-center text-xs text-gray-400 py-2">…and {rows.length - 10} more rows</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
