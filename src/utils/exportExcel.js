import ExcelJS from 'exceljs'

const PDEU_BLUE  = '00003087'
const HEADER_BG  = 'FFEEF2FF'
const ALT_ROW_BG = 'FFF8F9FF'

/**
 * Export rows to a single-sheet Excel file and trigger browser download.
 * @param {object[]} rows     Data rows
 * @param {object[]} columns  Array of { key, label } in desired export order
 * @param {string}   sheetName
 * @param {string}   fileName  Without .xlsx extension
 */
export async function exportToExcel(rows, columns, sheetName = 'Data', fileName = 'export') {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'DIC Mechanical Portal'
  wb.created  = new Date()

  const ws = wb.addWorksheet(sheetName.slice(0, 31))

  ws.columns = columns.map(c => ({
    key:   c.key,
    width: Math.max(c.label.length + 4, 18),
  }))

  // Header row
  const headerRow = ws.addRow(columns.map(c => c.label))
  headerRow.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: PDEU_BLUE }, size: 10 }
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
    cell.alignment = { vertical: 'middle', wrapText: false }
    cell.border    = { bottom: { style: 'thin', color: { argb: PDEU_BLUE } } }
  })
  ws.getRow(1).height = 22

  // Data rows
  rows.forEach((row, idx) => {
    const values = columns.map(c => {
      const val = row[c.key]
      if (val === null || val === undefined) return ''
      if (typeof val === 'boolean') return val ? 'Yes' : 'No'
      if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val))
        return new Date(val).toLocaleDateString('en-IN')
      return val
    })
    const dataRow = ws.addRow(values)
    if (idx % 2 === 1) {
      dataRow.eachCell({ includeEmpty: true }, cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW_BG } }
      })
    }
    dataRow.eachCell({ includeEmpty: true }, cell => {
      cell.alignment = { vertical: 'top', wrapText: true }
    })
  })

  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await wb.xlsx.writeBuffer()
  downloadBuffer(buffer, `${fileName}.xlsx`)
}

/**
 * Export multiple tabs — one sheet per tab.
 */
export async function exportMultiSheet(sheets) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'DIC Mechanical Portal'
  wb.created  = new Date()

  for (const { rows, columns, sheetName } of sheets) {
    const ws = wb.addWorksheet(sheetName.slice(0, 31))
    ws.columns = columns.map(c => ({ key: c.key, width: Math.max(c.label.length + 4, 18) }))

    const headerRow = ws.addRow(columns.map(c => c.label))
    headerRow.eachCell(cell => {
      cell.font   = { bold: true, color: { argb: PDEU_BLUE } }
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BG } }
      cell.border = { bottom: { style: 'thin', color: { argb: PDEU_BLUE } } }
    })

    rows.forEach((row, idx) => {
      const values = columns.map(c => {
        const val = row[c.key]
        if (val === null || val === undefined) return ''
        if (typeof val === 'boolean') return val ? 'Yes' : 'No'
        return val
      })
      const dataRow = ws.addRow(values)
      if (idx % 2 === 1) {
        dataRow.eachCell({ includeEmpty: true }, cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ALT_ROW_BG } }
        })
      }
    })

    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  const buffer = await wb.xlsx.writeBuffer()
  downloadBuffer(buffer, `PDEU_ME_Export_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

// ── Browser download helper ───────────────────────────────────
function downloadBuffer(buffer, fileName) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
