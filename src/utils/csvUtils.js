// ── CSV utilities ─────────────────────────────────────────────

// These field types are skipped in CSV (handled via UI only)
const SKIP_TYPES = ['boolean', 'sdg_multi']

/**
 * Generate and download a CSV template for a tab.
 */
export function downloadTemplate(tab) {
  const fields = tab.fields.filter(f => !SKIP_TYPES.includes(f.type))

  const headers = fields.map(f => f.label)
  const hints   = fields.map(f => {
    if (f.type === 'proof_link') return 'https://pdpu-my.sharepoint.com/... or https://drive.google.com/...'
    if (f.type === 'select')     return f.options?.slice(0, 3).join(' / ') || ''
    if (f.type === 'date')       return 'YYYY-MM-DD'
    if (f.type === 'datetime')   return 'YYYY-MM-DD HH:MM'
    if (f.type === 'number')     return '0'
    if (f.type === 'url')        return 'https://'
    if (f.type === 'file')       return 'https://onedrive.live.com/...'
    if (f.key === 'report_name') return '5_Publications_DrRaviKant'
    if (f.key === 'sdg_goals')   return '1,3,7  (comma-separated SDG numbers)'
    return ''
  })

  // Add a note row about SDG
  const noteLine = ['NOTE: SDG Goals field — enter comma-separated SDG numbers e.g. 3,7,13 (1=No Poverty … 17=Partnerships)']

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

  const headerRow = parseLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim())

  // label → field key (case-insensitive, also support field keys directly)
  const labelToKey = {}
  tab.fields.forEach(f => {
    labelToKey[f.label.toLowerCase()] = f.key
    labelToKey[f.key.toLowerCase()]   = f.key
  })

  const colMap  = headerRow.map(h => labelToKey[h.toLowerCase()] || null)
  const unknown = headerRow.filter(h => !labelToKey[h.toLowerCase()] && !h.startsWith('NOTE'))
  const errors  = unknown.length ? [`Unknown columns (ignored): ${unknown.join(', ')}`] : []

  const records = []
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('"NOTE') || lines[i].trim().startsWith('NOTE')) continue
    const cells   = parseLine(lines[i]).map(c => c.replace(/^"|"$/g, '').trim())
    const row     = {}
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

function trigger(csv, filename) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
