import { useState } from 'react'
import JSZip from 'jszip'
import { downloadProof } from '../../lib/filestore'
import toast from 'react-hot-toast'

/**
 * Admin: Download all proof PDFs for filtered records + Excel as a ZIP.
 * Uses the same GitHub PAT — no Azure, no extra auth.
 *
 * Props:
 *   rows     — filtered record rows
 *   columns  — export columns for the Excel
 *   tab      — tab config object
 *   label    — filename prefix e.g. "05_Publications_2024-25"
 */
export default function ProofDownloader({ rows, columns, tab, label }) {
  const [status,   setStatus]   = useState('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 })

  // Only rows that have an uploaded proof path (GitHub path string)
  const rowsWithProof = rows.filter(r =>
    r.drive_link && r.drive_link.startsWith('proofs/')
  )
  const noProof = rows.length - rowsWithProof.length

  async function downloadAll() {
    if (!rowsWithProof.length) {
      toast.error('No proof files found in filtered records.')
      return
    }

    setStatus('working')
    setProgress({ done: 0, total: rowsWithProof.length, failed: 0 })

    const zip    = new JSZip()
    let   failed = 0

    // 1. Build Excel in-memory
    toast('Building Excel…', { id: 'zip', duration: 120000 })
    try {
      const ExcelJS = (await import('exceljs')).default
      const wb = new ExcelJS.Workbook()
      wb.creator = 'PDEU ME Portal'
      const ws = wb.addWorksheet(tab.name.slice(0, 31))
      ws.columns = columns.map(c => ({ key: c.key, width: Math.max(c.label.length + 4, 18) }))
      const hRow = ws.addRow(columns.map(c => c.label))
      hRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: '00003087' } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } }
        cell.border = { bottom: { style: 'thin', color: { argb: '00003087' } } }
      })
      ws.views = [{ state: 'frozen', ySplit: 1 }]
      rows.forEach((row, i) => {
        const vals = columns.map(c => {
          const v = row[c.key]
          if (v == null) return ''
          if (typeof v === 'boolean') return v ? 'Yes' : 'No'
          return v
        })
        const dRow = ws.addRow(vals)
        if (i % 2 === 1) {
          dRow.eachCell({ includeEmpty: true }, cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FF' } }
          })
        }
      })
      const buf = await wb.xlsx.writeBuffer()
      zip.file(`${label || tab.name}_data.xlsx`, buf)
    } catch (e) {
      console.warn('Excel build failed:', e)
    }

    // 2. Download each proof PDF from GitHub
    const proofFolder = zip.folder('proofs')
    for (let i = 0; i < rowsWithProof.length; i++) {
      const row = rowsWithProof[i]
      toast(`Fetching proof ${i + 1} of ${rowsWithProof.length}…`, { id: 'zip' })
      setProgress({ done: i + 1, total: rowsWithProof.length, failed })

      try {
        const { blob, fileName } = await downloadProof(row.drive_link)
        // Prefix with faculty last name for easy identification
        const lastName = (row.facultyName || 'unknown').split(' ').pop()
        proofFolder.file(`${lastName}_${fileName}`, blob)
      } catch (e) {
        console.warn(`Failed to fetch proof for ${row.facultyName}:`, e.message)
        failed++
        setProgress(p => ({ ...p, failed }))
      }
    }

    // 3. Generate ZIP and trigger download
    toast('Zipping files…', { id: 'zip' })
    try {
      const zipBlob  = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      })
      const url = URL.createObjectURL(zipBlob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `${label || tab.name}_data+proofs.zip`
      a.click()
      URL.revokeObjectURL(url)

      const ok = rowsWithProof.length - failed
      toast.success(
        failed === 0
          ? `Downloaded ${ok} proof PDF${ok !== 1 ? 's' : ''} + Excel!`
          : `Downloaded ${ok} proofs + Excel. ${failed} file${failed !== 1 ? 's' : ''} couldn't be fetched.`,
        { id: 'zip', duration: 6000 }
      )
    } catch (e) {
      toast.error('ZIP creation failed: ' + e.message, { id: 'zip' })
    }

    setStatus('done')
    setTimeout(() => setStatus('idle'), 4000)
  }

  if (!rowsWithProof.length) return null

  return (
    <div className="mt-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-2">
            📦 Download Excel + Proof PDFs as ZIP
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
            {rowsWithProof.length} proof file{rowsWithProof.length !== 1 ? 's' : ''} for current filter
            {noProof > 0 && ` · ${noProof} record${noProof !== 1 ? 's' : ''} without proof`}
          </p>
          {status === 'working' && progress.total > 0 && (
            <div className="mt-2 space-y-1">
              <div className="h-1.5 w-56 bg-purple-200 dark:bg-purple-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-purple-500 dark:text-purple-400">
                {progress.done} / {progress.total} files
                {progress.failed > 0 && ` · ${progress.failed} failed`}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={downloadAll}
          disabled={status === 'working'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50"
          style={{ backgroundColor: '#7C3AED' }}
        >
          {status === 'working'
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Working…</>
            : status === 'done'
            ? '✅ Downloaded!'
            : '📦 Download ZIP'
          }
        </button>
      </div>
    </div>
  )
}
