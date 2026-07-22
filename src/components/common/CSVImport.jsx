import { useState, useRef } from 'react'
import { parseCSV, downloadTemplate } from '../../utils/csvUtils'
import { validateRecord } from '../../utils/recordValidation'

function validateRow(tab, row) {
  const issue = validateRecord(tab, row, { requireProof: false })[0]
  return issue?.message || null
}

export default function CSVImport({ tab, onImport, disabled }) {
  const [open,     setOpen]     = useState(false)
  const [preview,  setPreview]  = useState(null)
  const [fileName, setFileName] = useState('')
  const [saving,   setSaving]   = useState(false)
  const fileRef = useRef()

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const parsed = parseCSV(ev.target.result, tab)
      // Tag each row with a validation error if any
      const annotated = parsed.records.map(row => ({
        ...row,
        _error: validateRow(tab, row),
      }))
      setPreview({ ...parsed, records: annotated })
    }
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  const validRows   = preview?.records?.filter(r => !r._error) || []
  const invalidRows = preview?.records?.filter(r =>  r._error) || []
  const hasInvalid  = invalidRows.length > 0

  async function confirmImport() {
    if (!validRows.length) return
    setSaving(true)
    try {
      // Strip the _error annotation before saving
      await onImport(validRows.map(({ _error, ...row }) => row))
      setPreview(null); setFileName(''); setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const previewCols = tab.fields
    .filter(f => !['boolean', 'sdg_multi'].includes(f.type))
    .slice(0, 4)

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="btn-secondary text-sm flex items-center gap-2"
        disabled={disabled}
      >
         Bulk Import via CSV
        <span className={`text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="mt-3 card border-2 border-dashed border-gray-200 dark:border-gray-600 !p-4 space-y-4">

          {/* Step 1 */}
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-[220px]">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Step 1 — Download the template
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Pre-formatted CSV with all column headers. Fill it in Excel or Google Sheets.
                <br />
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Supporting PDFs are attached individually after the records are imported.
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadTemplate(tab)}
              className="btn-secondary text-sm flex items-center gap-2 whitespace-nowrap"
            >
              ⬇ Download Template
            </button>
          </div>

          <hr className="border-gray-100 dark:border-gray-700" />

          {/* Step 2 */}
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-[220px]">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                Step 2 — Upload your filled CSV
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Do not change the column headers. Review the parsed records before confirming the import.
              </p>
            </div>
            <div>
              <input ref={fileRef} type="file" accept=".csv,.xls,text/csv,application/vnd.ms-excel"
                onChange={handleFile} className="hidden" id="csv-upload-input" />
              <label htmlFor="csv-upload-input"
                className="btn-primary text-sm cursor-pointer flex items-center gap-2 whitespace-nowrap">
                 Upload CSV
              </label>
              {fileName && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1"> {fileName}</p>}
            </div>
          </div>

          {/* Parse warnings */}
          {preview?.errors?.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Warnings:</p>
              {preview.errors.map((e, i) => (
                <p key={i} className="text-xs text-amber-600 dark:text-amber-400">• {e}</p>
              ))}
            </div>
          )}

          {preview?.records?.length > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300">
              Imported records will be marked as Supporting Document Pending. Open each record after import and upload its required PDF.
            </div>
          )}

          {/* Preview table */}
          {preview?.records?.length > 0 && (
            <>
              {/* Summary */}
              <div className="flex gap-3 flex-wrap">
                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-1 rounded-full font-medium">
                   {validRows.length} valid row{validRows.length !== 1 ? 's' : ''} — will be imported
                </span>
                {hasInvalid && (
                  <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-1 rounded-full font-medium">
                     {invalidRows.length} row{invalidRows.length !== 1 ? 's' : ''} rejected — see details below
                  </span>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
                <table className="w-full text-xs">
                  <thead className="bg-pdeu-light dark:bg-gray-700">
                    <tr>
                      <th className="px-2 py-2 text-left text-pdeu-blue dark:text-blue-400 font-semibold">#</th>
                      {previewCols.map(f => (
                        <th key={f.key} className="px-3 py-2 text-left text-pdeu-blue dark:text-blue-400 font-semibold whitespace-nowrap">
                          {f.label}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-left text-pdeu-blue dark:text-blue-400 font-semibold">Supporting Document</th>
                      <th className="px-3 py-2 text-left text-pdeu-blue dark:text-blue-400 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.records.slice(0, 15).map((row, i) => (
                      <tr key={i}
                        className={`border-t border-gray-100 dark:border-gray-700
                          ${row._error
                            ? 'bg-red-50/60 dark:bg-red-900/10'
                            : i % 2 === 1 ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''
                          }`}
                      >
                        <td className="px-2 py-1.5 text-gray-400 dark:text-gray-500">{i + 1}</td>
                        {previewCols.map(f => (
                          <td key={f.key} className="px-3 py-1.5 text-gray-700 dark:text-gray-300 max-w-[150px] truncate"
                            title={String(row[f.key] ?? '')}>
                            {row[f.key] || <span className="text-gray-300 dark:text-gray-600">—</span>}
                          </td>
                        ))}
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <span className="text-amber-600 dark:text-amber-400">Pending after import</span>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          {row._error
                            ? <span className="text-red-500 dark:text-red-400 font-medium">Rejected</span>
                            : <span className="text-green-600 dark:text-green-400 font-medium">Ready</span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.records.length > 15 && (
                  <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-2">
                    …and {preview.records.length - 15} more rows
                  </p>
                )}
              </div>

              {/* Rejected rows detail */}
              {hasInvalid && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                  <p className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                     Rejected rows — fix these in your CSV and re-upload:
                  </p>
                  {invalidRows.slice(0, 5).map((row, i) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400">
                      • Row {preview.records.indexOf(row) + 2}: {row._error}
                    </p>
                  ))}
                  {invalidRows.length > 5 && (
                    <p className="text-xs text-red-500 dark:text-red-400">…and {invalidRows.length - 5} more</p>
                  )}
                </div>
              )}

              {validRows.length > 0 && (
                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={confirmImport}
                    disabled={saving}
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    {saving
                      ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Importing {validRows.length} rows…</>
                      : ` Import ${validRows.length} Valid Row${validRows.length !== 1 ? 's' : ''}`
                    }
                  </button>
                  <button type="button" onClick={() => { setPreview(null); setFileName('') }}
                    className="btn-secondary text-sm">
                    Cancel
                  </button>
                </div>
              )}

              {validRows.length === 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                  <p className="text-sm font-semibold text-red-700 dark:text-red-400">
No valid data rows were found in the CSV.
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
Correct the CSV data errors and upload the file again.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
