import { useState, useRef } from 'react'
import { parseCSV, downloadTemplate } from '../../utils/csvUtils'

/**
 * CSV Import component — shown on every tab form.
 * Faculty can: download a template, fill it, upload it,
 * preview the parsed rows, then confirm to save all at once.
 *
 * Props:
 *   tab          — the tab config object
 *   onImport(rows) — called with array of parsed records to save
 *   disabled     — disable while parent is saving
 */
export default function CSVImport({ tab, onImport, disabled }) {
  const [open,     setOpen]     = useState(false)
  const [preview,  setPreview]  = useState(null)   // { records, errors }
  const [fileName, setFileName] = useState('')
  const [saving,   setSaving]   = useState(false)
  const fileRef = useRef()

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const result = parseCSV(ev.target.result, tab)
      setPreview(result)
    }
    reader.readAsText(file, 'utf-8')
    // reset input so same file can be re-selected
    e.target.value = ''
  }

  async function confirmImport() {
    if (!preview?.records?.length) return
    setSaving(true)
    try {
      await onImport(preview.records)
      setPreview(null)
      setFileName('')
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  // Preview columns — first 5 non-bulky fields
  const previewCols = tab.fields
    .filter(f => !['file', 'boolean', 'textarea'].includes(f.type))
    .slice(0, 5)

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="btn-secondary text-sm flex items-center gap-2"
        disabled={disabled}
      >
        📂 Bulk Import via CSV
        <span className={`text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="mt-3 card border-2 border-dashed border-gray-200 dark:border-gray-600 !p-4 space-y-4">
          {/* Step 1: Download template */}
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-[220px]">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Step 1 — Download the template
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Pre-formatted CSV with all column headers for this tab. Fill it in Excel or Google Sheets.
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadTemplate(tab)}
              className="btn-secondary text-sm flex items-center gap-2 whitespace-nowrap"
            >
              ⬇️ Download Template
            </button>
          </div>

          <hr className="border-gray-100 dark:border-gray-700" />

          {/* Step 2: Upload filled CSV */}
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-[220px]">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Step 2 — Upload your filled CSV
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Do not change the column headers. Each row = one entry.
              </p>
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="hidden"
                id="csv-upload-input"
              />
              <label
                htmlFor="csv-upload-input"
                className="btn-primary text-sm cursor-pointer flex items-center gap-2 whitespace-nowrap"
              >
                📤 Upload CSV
              </label>
              {fileName && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">📎 {fileName}</p>
              )}
            </div>
          </div>

          {/* Errors */}
          {preview?.errors?.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Warnings:</p>
              {preview.errors.map((e, i) => (
                <p key={i} className="text-xs text-amber-600 dark:text-amber-400">• {e}</p>
              ))}
            </div>
          )}

          {/* Preview table */}
          {preview?.records?.length > 0 && (
            <>
              <div>
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
                  Step 3 — Preview ({preview.records.length} rows found)
                </p>
                <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
                  <table className="w-full text-xs">
                    <thead className="bg-pdeu-light dark:bg-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left text-pdeu-blue dark:text-blue-400 font-semibold">#</th>
                        {previewCols.map(f => (
                          <th key={f.key} className="px-3 py-2 text-left text-pdeu-blue dark:text-blue-400 font-semibold whitespace-nowrap">
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.records.slice(0, 10).map((row, i) => (
                        <tr key={i} className={`border-t border-gray-100 dark:border-gray-700 ${i % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}>
                          <td className="px-3 py-1.5 text-gray-400 dark:text-gray-500">{i + 1}</td>
                          {previewCols.map(f => (
                            <td key={f.key} className="px-3 py-1.5 text-gray-700 dark:text-gray-300 max-w-[180px] truncate"
                              title={String(row[f.key] ?? '')}>
                              {row[f.key] || <span className="text-gray-300 dark:text-gray-600">—</span>}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.records.length > 10 && (
                    <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-2">
                      …and {preview.records.length - 10} more rows
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={saving}
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  {saving
                    ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving {preview.records.length} rows…</>
                    : `✅ Import All ${preview.records.length} Rows`
                  }
                </button>
                <button
                  type="button"
                  onClick={() => { setPreview(null); setFileName('') }}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>

              {saving && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  ⏳ Saving to GitHub — this may take {Math.max(5, preview.records.length * 2)} seconds for {preview.records.length} rows…
                </p>
              )}
            </>
          )}

          {preview && preview.records.length === 0 && !preview.errors.length && (
            <p className="text-sm text-red-500 dark:text-red-400">No valid rows found in the CSV.</p>
          )}
        </div>
      )}
    </div>
  )
}
