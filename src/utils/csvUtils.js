// ── CSV utilities ─────────────────────────────────────────────

/**
 * Generate and download a CSV template for a tab.
 * First row = column headers (field labels), second row = example hints.
 */
export function downloadTemplate(tab) {
  const fields = tab.fields.filter(f => f.type !== 'boolean')

  const headers = fields.map(f => f.label)
  const hints   = fields.map(f => {
    if (f.type === 'select')   return f.options?.slice(0, 2).join(' / ') || ''
    if (f.type === 'date')     return 'YYYY-MM-DD'
    if (f.type === 'datetime') return 'YYYY-MM-DD HH:MM'
    if (f.type === 'number')   return '0'
    if (f.type === 'url')      return 'https://'
    if (f.type === 'file')     return 'https://onedrive.live.com/...'
    return ''
  })

  const rows = [headers, hints]
  const csv  = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')

  trigger(csv, `${tab.number}_${tab.name.replace(/\s+/g, '_')}_template.csv`)
}

/**
 * Parse CSV text into an array of objects keyed by tab field keys.
 * First row = headers (must match field labels, case-insensitive).
 * Returns { records, errors }
 */
export function parseCSV(text, tab) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return { records: [], errors: ['CSV must have at least a header row and one data row.'] }

  // Parse CSV respecting quoted fields
  function parseLine(line) {
    const result = []
    let cur = '', inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === ',' && !inQuote) {
        result.push(cur.trim()); cur = ''
      } else {
        cur += ch
      }
    }
    result.push(cur.trim())
    return result
  }

  const headerRow = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())

  // Build label → field key map (case-insensitive)
  const labelToKey = {}
  tab.fields.forEach(f => {
    labelToKey[f.label.toLowerCase()] = f.key
  })

  // Map header columns to field keys
  const colMap = headerRow.map(h => labelToKey[h.toLowerCase()] || null)
  const unmapped = headerRow.filter(h => !labelToKey[h.toLowerCase()])

  const errors = []
  if (unmapped.length) {
    errors.push(`Unknown columns (will be ignored): ${unmapped.join(', ')}`)
  }

  const records = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const cells = parseLine(line).map(c => c.replace(/^"|"$/g, '').trim())
    const row   = {}
    let   hasData = false

    colMap.forEach((key, ci) => {
      if (!key) return
      const val = cells[ci] ?? ''
      if (val !== '') { row[key] = val; hasData = true }
    })

    if (hasData) records.push(row)
  }

  if (!records.length) errors.push('No data rows found after the header.')
  return { records, errors }
}

/** Trigger browser CSV download */
function trigger(csv, filename) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
