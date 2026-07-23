import { useState } from 'react'
import JSZip from 'jszip'
import toast from 'react-hot-toast'
import { downloadProof } from '../../lib/filestore'

async function fetchProofBlob(storedPath) {
  const { blob, fileName } = await downloadProof(storedPath)
  return { blob, name: fileName }
}

// Build Excel buffer in-memory (without triggering browser download)
async function buildExcelBuffer(rows, columns, sheetName) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'DIC Mechanical Portal'
  const ws = wb.addWorksheet(sheetName.slice(0, 31))
  ws.columns = columns.map(c => ({ key: c.key, width: Math.max(c.label.length + 4, 18) }))

  const hRow = ws.addRow(columns.map(c => c.label))
  hRow.eachCell(cell => {
    cell.font   = { bold: true, color: { argb: '00003087' } }
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } }
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

  return wb.xlsx.writeBuffer()
}

/**
 * Admin: Download all supporting-document PDFs + Excel as a single ZIP.
 *
 * Props:
 *   rows    — filtered record rows (already filtered by faculty/year)
 *   columns — export columns for the Excel sheet
 *   tab     — tab config object
 *   label   — ZIP filename prefix
 */
export default function ProofDownloader({ rows, columns, tab, label }) {
  const [status,   setStatus]   = useState('idle')
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 })

  // Rows that have a GitHub proof path (starts with "proofs/")
  // Collect all proof paths from any field ending in _pdf or drive_link
  const getProofPaths = r => {
    const paths = []
    if (r.drive_link?.startsWith('proofs/')) paths.push({ path: r.drive_link, label: 'proof' })
    Object.entries(r).forEach(([k, v]) => {
      if (k.endsWith('_pdf') && typeof v === 'string' && v.startsWith('proofs/'))
        paths.push({ path: v, label: k.replace(/_pdf$/, '').replace(/_/g, '-') })
    })
    return paths
  }
  const withProof = rows.filter(r => getProofPaths(r).length > 0)
  const proofItems = rows.flatMap(row =>
    getProofPaths(row).map(proof => ({ row, ...proof }))
  )
  const withoutProof = rows.length - withProof.length

  async function downloadZip() {
    if (!withProof.length) {
      toast.error('No supporting document files found for these records.')
      return
    }

    setStatus('working')
    setProgress({ done: 0, total: proofItems.length, failed: 0 })

    const zip    = new JSZip()
    let   failed = 0

    // 1 — Excel sheet
    toast('Building Excel…', { id: 'proof-zip', duration: 300000 })
    try {
      const buf = await buildExcelBuffer(rows, columns, tab.name)
      zip.file(`${label || tab.name}_data.xlsx`, buf)
    } catch (e) {
      console.warn('Excel build failed:', e.message)
    }

    // 2 — Supporting-document PDFs
    const proofFolder = zip.folder('proofs')
    for (let i = 0; i < proofItems.length; i++) {
      const { row, path, label: proofLabel } = proofItems[i]
      toast(`Fetching proof ${i + 1} / ${proofItems.length}…`, { id: 'proof-zip', duration: 300000 })
      setProgress({ done: i + 1, total: proofItems.length, failed })

      try {
        const { blob, name } = await fetchProofBlob(path)
        const lastName = (row.facultyName || 'unknown').trim().split(/\s+/).pop()
        const recordId = String(row.id || i + 1).replace(/[^a-zA-Z0-9_-]/g, '')
        proofFolder.file(`${lastName}_${recordId}_${proofLabel}_${name}`, blob)
      } catch (e) {
        console.warn(`Proof download failed for ${row.facultyName}: ${e.message}`)
        failed++
        setProgress(progress => ({ ...progress, failed }))
        const lastName = (row.facultyName || 'unknown').trim().split(/\s+/).pop()
        proofFolder.file(
          `FAILED_${lastName}_${proofLabel}.txt`,
          `Could not download supporting document for ${row.facultyName}.
Path: ${path}
Error: ${e.message}`
        )
      }
    }

    // 3 — Generate and trigger download
    toast('Creating ZIP…', { id: 'proof-zip', duration: 300000 })
    try {
      const zipBlob  = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
      const url      = URL.createObjectURL(zipBlob)
      const a        = document.createElement('a')
      const safeName = (label || tab.name).replace(/[^\w\-]/g, '_')
      a.href     = url
      a.download = `${safeName}_data+proofs.zip`
      a.click()
      URL.revokeObjectURL(url)

      const ok = proofItems.length - failed
      toast.success(
        failed === 0
          ? ` Downloaded ${ok} supporting-document PDF${ok !== 1 ? 's' : ''} + Excel in one ZIP`
          : `Downloaded ${ok} proofs + Excel. ${failed} file${failed !== 1 ? 's' : ''} failed.`,
        { id: 'proof-zip', duration: 6000 }
      )
    } catch (e) {
      toast.error('ZIP creation failed: ' + e.message, { id: 'proof-zip' })
    }

    setStatus('done')
    setTimeout(() => setStatus('idle'), 5000)
  }

  // Don't render if nothing to download
  if (!withProof.length) return null

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="mt-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-2">
             Download Excel + Supporting-document PDFs as ZIP
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-0.5">
            {withProof.length} supporting document file{withProof.length !== 1 ? 's' : ''} in current filter
            {withoutProof > 0 && <span className="text-gray-400 ml-1">· {withoutProof} record{withoutProof !== 1 ? 's' : ''} without proof</span>}
          </p>

          {status === 'working' && progress.total > 0 && (
            <div className="mt-2 space-y-1 max-w-xs">
              <div className="h-1.5 bg-purple-200 dark:bg-purple-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-purple-500 dark:text-purple-400">
                {progress.done} / {progress.total} files
                {progress.failed > 0 && <span className="text-amber-500 ml-1">· {progress.failed} failed</span>}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={downloadZip}
          disabled={status === 'working'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity disabled:opacity-60 whitespace-nowrap flex-shrink-0"
          style={{ backgroundColor: '#7C3AED' }}
        >
          {status === 'working'
            ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Working…</>
            : status === 'done'
            ? 'Completed'
            : 'Download ZIP'
          }
        </button>
      </div>
    </div>
  )
}
