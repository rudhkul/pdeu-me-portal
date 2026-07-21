// ── CSV utilities ─────────────────────────────────────────────

// Field types skipped entirely in CSV — must be done via the portal UI
const SKIP_TYPES = [
  'boolean',
  'sdg_multi',
  'proof_upload',        // PDFs must be uploaded via the portal, not via CSV
  'profile_picture_upload',
  'faculty_select',      // interactive picker only
]

// Individual keys always excluded from CSV
const SKIP_KEYS = [
  'report_name',  // auto-generated from uploaded filename
]

const isCSVField = field => field.key === 'drive_link' || (
  !SKIP_TYPES.includes(field.type) && !SKIP_KEYS.includes(field.key)
)

/**
 * Generate and download a CSV template for a tab.
 */
export function downloadTemplate(tab) {
  const fields = tab.fields.filter(isCSVField)

  const headers = fields.map(f => f.label)
  const hints   = fields.map(f => {
    if (f.type === 'select')   return f.options?.join(' / ') || ''
    if (f.type === 'date')     return 'YYYY-MM-DD'
    if (f.type === 'month')    return 'YYYY-MM'
    if (f.type === 'datetime') return 'YYYY-MM-DD HH:MM'
    if (f.type === 'number')   return '0'
    if (f.type === 'url')      return 'https://'
    if (f.type === 'file')     return 'https://'
    if (f.key === 'sdg_goals') return '1,3,7  (comma-separated SDG numbers)'
    return ''
  })

  // Add a note row about SDG and PDFs
  const noteLine = [
    'NOTE: SDG Goals — enter comma-separated numbers e.g. 3,7,13 | ' +
    'PDF proofs — upload after import via the Edit button in the portal'
  ]

  const rows = [headers, hints, noteLine]
  const csv  = rows.map(r =>
    r.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n')

  trigger(csv, `${tab.number}_${tab.name.replace(/\s+/g, '_')}_template.csv`)
}

/**
 * Parse CSV text → array of field-key-keyed objects.
 * Returns { records, errors }
 */
export function parseCSV(text, tab) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return { records: [], errors: ['CSV must have at least a header row and one data row.'] }

  function parseLine(line) {
    const result = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++ }
        else inQ = !inQ
      } else if (ch === ',' && !inQ) {
        result.push(cur.trim()); cur = ''
      } else { cur += ch }
    }
    result.push(cur.trim())
    return result
  }

  const headerRow = parseLine(lines[0]).map(h =>
    h.replace(/^"|"$/g, '').replace(/^\uFEFF/, '').trim()
  )

  const normalizeHeader = value => String(value || '')
    .toLowerCase()
    .replace(/\([^)]*[₹?][^)]*\)/g, '')
    .replace(/[–—]/g, '-')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

  const labelToKey = {}
  tab.fields
    .filter(isCSVField)
    .forEach(f => {
      labelToKey[normalizeHeader(f.label)] = f.key
      labelToKey[normalizeHeader(f.key)] = f.key
    })

  labelToKey[normalizeHeader('Drive Link')] = 'drive_link'
  labelToKey[normalizeHeader('OneDrive / Drive Link')] = 'drive_link'
  labelToKey[normalizeHeader('Proof Link')] = 'drive_link'

  const colMap = headerRow.map(h =>
    labelToKey[normalizeHeader(h)] || null
  )
  const unknown = headerRow.filter(h =>
    !labelToKey[normalizeHeader(h)] && !h.startsWith('NOTE')
  )
  const errors  = unknown.length ? [`Unknown columns (ignored): ${unknown.join(', ')}`] : []

  const records = []
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('"NOTE') || lines[i].trim().startsWith('NOTE')) continue
    const cells   = parseLine(lines[i]).map(c => c.replace(/^"|"$/g, '').trim())
    const row     = {}
    let   hasData = false
    colMap.forEach((key, ci) => {
      if (!key) return
      let val = cells[ci] ?? ''
      const field = tab.fields.find(item => item.key === key)
      const dateMatch =
        field?.type === 'date' &&
        val.match(/^(\d{2})-(\d{2})-(\d{4})$/)

      if (dateMatch) {
        val = dateMatch[3] + '-' + dateMatch[2] + '-' + dateMatch[1]
      }

      if (val !== '') { row[key] = val; hasData = true }
    })
    if (hasData) records.push(row)
  }

  if (!records.length) errors.push('No data rows found after the header.')
  return { records, errors }
}

function trigger(csv, filename) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
