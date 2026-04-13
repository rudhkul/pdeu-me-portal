#!/usr/bin/env node
// Import existing Excel data into the portal data repo
// Usage: node scripts/import-excel.js "./path/to/file.xlsx"
//
// Reads each tab, detects data rows, maps to portal schema, writes to GitHub.
// Same env vars as init-repo.js

import ExcelJS from 'exceljs'
import { resolve } from 'path'
import { randomBytes } from 'crypto'

const OWNER  = process.env.DATA_REPO_OWNER
const REPO   = process.env.DATA_REPO_NAME
const PAT    = process.env.GITHUB_PAT
if (!OWNER || !REPO || !PAT) { console.error('❌  Set DATA_REPO_OWNER, DATA_REPO_NAME, GITHUB_PAT'); process.exit(1) }

const XLSX_PATH = process.argv[2]
if (!XLSX_PATH) { console.error('❌  Usage: node scripts/import-excel.js file.xlsx'); process.exit(1) }

const API     = `https://api.github.com/repos/${OWNER}/${REPO}/contents`
const HEADERS = { Authorization: `Bearer ${PAT}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }

async function readJSON(path) {
  const res = await fetch(`${API}/${path}`, { headers: HEADERS })
  if (res.status === 404) return { data: null, sha: null }
  const meta = await res.json()
  return { data: JSON.parse(Buffer.from(meta.content, 'base64').toString()), sha: meta.sha }
}

async function writeJSON(path, data, sha = null) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64')
  const res = await fetch(`${API}/${path}`, {
    method: 'PUT', headers: HEADERS,
    body: JSON.stringify({ message: `import: ${path}`, content, ...(sha ? { sha } : {}) })
  })
  if (!res.ok) throw new Error((await res.json()).message)
}

function cellVal(cell) {
  if (!cell) return null
  const v = cell.value
  if (v === null || v === undefined) return null
  if (typeof v === 'object' && v.result !== undefined) return v.result   // formula
  if (typeof v === 'object' && v.text !== undefined) return v.text       // rich text
  if (v instanceof Date) return v.toISOString().split('T')[0]
  return String(v).trim() || null
}

function isFacultyGroupRow(row, colCount) {
  // Group rows look like "Prof. Name : 5" in col 1, rest NaN
  const first = cellVal(row.getCell(1))
  if (!first) return false
  const emptyCount = Array.from({ length: colCount - 1 }, (_, i) => cellVal(row.getCell(i + 2))).filter(v => !v).length
  return emptyCount >= colCount - 2 && / : \d+$/.test(first)
}

// Tab sheet name → portal tabId mapping
const SHEET_TAB_MAP = {
  '1.Faculty Information':          'tab1',
  '2.Faculty Student Achievement':  'tab2',
  '3.Faculty Subject Mapping':      'tab3',
  '4.Ph.D. St. Details':            'tab4',
  '5.Publication, Conference':      'tab5',
  '6.Projects, Consultancy':        'tab6',
  '7.Patents, Prototype':           'tab7',
  '8.Meetings, Alumni, Parent':     'tab8',
  '9.Talks, Workshops, STTP, FDP':  'tab9',
  '10.Memberships':                 'tab10',
  '11.Faculty Certification MOOCs': 'tab11',
  '12.e-Content developed by Facul':'tab12',
  '13.Faculty Support in Student P':'tab13',
  '14.Faculty TrainingCollaboratio':'tab14',
  '15.Facuty as Resource Persons':  'tab15',
  '16. Industrial_visits_Faculty_S':'tab16',
  '17. Academic Courses in Innovat':'tab17',
  '18. Placement data':             'tab18',
  '19. MOU':                        'tab19',
}

async function main() {
  console.log('\n📊  PDEU ME Portal — Excel Data Importer\n')

  // Load users to build name → id map
  const { data: users } = await readJSON('users.json')
  if (!users) { console.error('❌  Run init-repo.js first'); process.exit(1) }
  const nameMap = Object.fromEntries(users.map(u => [u.fullName.toLowerCase().trim(), u]))

  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(resolve(process.cwd(), XLSX_PATH))
  console.log(`Loaded: ${XLSX_PATH}\n`)

  let totalImported = 0

  for (const [sheetName, tabId] of Object.entries(SHEET_TAB_MAP)) {
    const ws = wb.getWorksheet(sheetName)
    if (!ws) { console.log(`  ⏭  Sheet not found: ${sheetName}`); continue }

    // Row 4 (index 3) = headers, rows 5+ = data
    const headerRow = ws.getRow(4)
    const headers   = []
    headerRow.eachCell({ includeEmpty: true }, (cell, colIdx) => {
      headers[colIdx] = cellVal(cell) || `col_${colIdx}`
    })
    const colCount = headers.length

    // Group data rows by faculty
    const byFaculty = {}   // facultyName → [rows]
    let currentFaculty = null

    ws.eachRow((row, rowIdx) => {
      if (rowIdx <= 4) return   // skip headers
      if (isFacultyGroupRow(row, colCount)) {
        const raw = cellVal(row.getCell(1)) || ''
        currentFaculty = raw.replace(/ : \d+$/, '').trim()
        if (!byFaculty[currentFaculty]) byFaculty[currentFaculty] = []
      } else if (currentFaculty) {
        // Check if row has any data
        const vals = {}
        let hasData = false
        headers.forEach((h, ci) => {
          const v = cellVal(row.getCell(ci))
          if (v && h) { vals[h] = v; hasData = true }
        })
        if (hasData) byFaculty[currentFaculty].push(vals)
      }
    })

    let sheetImported = 0
    for (const [facultyName, rows] of Object.entries(byFaculty)) {
      if (!rows.length) continue
      const user = nameMap[facultyName.toLowerCase()]
      if (!user) { console.log(`    ⚠️  No portal account for: ${facultyName}`); continue }

      const now = new Date().toISOString()
      const records = rows.map(r => ({
        ...r,
        id: `imp_${randomBytes(6).toString('hex')}`,
        facultyName,
        createdAt: now,
        updatedAt: now,
        _imported: true,
      }))

      const path          = `records/${tabId}/${user.id}.json`
      const { data, sha } = await readJSON(path)
      const existing      = data || []
      // Skip if already has imported data
      if (existing.some(r => r._imported)) {
        console.log(`    ⏭  ${facultyName} already has imported data in ${tabId}`)
        continue
      }
      await writeJSON(path, [...existing, ...records], sha)
      sheetImported += records.length
    }

    console.log(`  ✅  ${sheetName}: imported ${sheetImported} records`)
    totalImported += sheetImported
  }

  console.log(`\n🎉  Done! Imported ${totalImported} total records.\n`)
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
