#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// bulk-import.js — Add many faculty users from a CSV file
//
// Usage: node scripts/bulk-import.js faculty.csv
//
// CSV format (with header row):
//   fullName,email,password
//   Prof. Surendra Singh Kachhwaha,surendra@sot.pdpu.ac.in,welcome@123
//   Dr. Garlapati Nagababu,nagababu@sot.pdpu.ac.in,welcome@123
//
// Same env vars as init-repo.js
// ─────────────────────────────────────────────────────────────

import { createHash, randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const OWNER  = process.env.DATA_REPO_OWNER
const REPO   = process.env.DATA_REPO_NAME
const PAT    = process.env.GITHUB_PAT
const SECRET = process.env.AUTH_SECRET

if (!OWNER || !REPO || !PAT || !SECRET) {
  console.error('❌  Missing env vars. Set DATA_REPO_OWNER, DATA_REPO_NAME, GITHUB_PAT, AUTH_SECRET')
  process.exit(1)
}

const csvPath = process.argv[2]
if (!csvPath) {
  console.error('❌  Usage: node scripts/bulk-import.js faculty.csv')
  console.error('\nCSV format:')
  console.error('fullName,email,password')
  console.error('Prof. A B C,abc@pdpu.ac.in,welcome@123')
  process.exit(1)
}

const API     = `https://api.github.com/repos/${OWNER}/${REPO}/contents`
const HEADERS = {
  Authorization:  `Bearer ${PAT}`,
  Accept:         'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
}

function hashPassword(p, salt) {
  return createHash('sha256').update(SECRET + salt + p).digest('hex')
}

function parseCSV(content) {
  const lines = content.trim().split('\n').map(l => l.trim()).filter(Boolean)
  const header = lines[0].split(',').map(h => h.trim().toLowerCase())

  const nameIdx  = header.indexOf('fullname')
  const emailIdx = header.indexOf('email')
  const passIdx  = header.indexOf('password')

  if (nameIdx === -1 || emailIdx === -1 || passIdx === -1) {
    throw new Error('CSV must have columns: fullName, email, password')
  }

  return lines.slice(1).map((line, i) => {
    // Handle quoted fields
    const cols = line.match(/(".*?"|[^,]+)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) || []
    if (cols.length < 3) throw new Error(`Row ${i + 2} is malformed: "${line}"`)
    return {
      fullName: cols[nameIdx],
      email:    cols[emailIdx],
      password: cols[passIdx],
    }
  })
}

async function readUsers() {
  const res  = await fetch(`${API}/users.json`, { headers: HEADERS })
  if (res.status === 404) return { users: [], sha: null }
  const meta = await res.json()
  return { users: JSON.parse(Buffer.from(meta.content, 'base64').toString()), sha: meta.sha }
}

async function writeUsers(users, sha) {
  const content = Buffer.from(JSON.stringify(users, null, 2)).toString('base64')
  const body    = { message: `portal: bulk import ${users.length} users`, content, ...(sha ? { sha } : {}) }
  const res     = await fetch(`${API}/users.json`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) })
  if (!res.ok) { const j = await res.json(); throw new Error(j.message) }
}

async function main() {
  console.log('\n📋  PDEU ME Portal — Bulk Faculty Import\n')

  // Read and parse CSV
  let entries
  try {
    const content = readFileSync(resolve(process.cwd(), csvPath), 'utf-8')
    entries = parseCSV(content)
  } catch (e) {
    console.error('❌  Failed to read CSV:', e.message)
    process.exit(1)
  }

  console.log(`Found ${entries.length} rows in CSV.\n`)

  const { users, sha } = await readUsers()
  const existingEmails  = new Set(users.map(u => u.email.toLowerCase()))

  let added   = 0
  let skipped = 0

  for (const entry of entries) {
    if (!entry.fullName || !entry.email || !entry.password) {
      console.log(`  ⚠️  Skipping incomplete row: ${JSON.stringify(entry)}`)
      skipped++
      continue
    }
    if (existingEmails.has(entry.email.toLowerCase())) {
      console.log(`  ⏭  Already exists: ${entry.email}`)
      skipped++
      continue
    }
    const salt = randomBytes(16).toString('hex')
    users.push({
      id:           `usr_${randomBytes(8).toString('hex')}`,
      fullName:     entry.fullName,
      email:        entry.email.trim(),
      role:         'faculty',
      salt,
      passwordHash: hashPassword(entry.password, salt),
    })
    existingEmails.add(entry.email.toLowerCase())
    console.log(`  ✅  Added: ${entry.fullName} <${entry.email}>`)
    added++
  }

  if (added === 0) {
    console.log('\nNo new users to add.')
    return
  }

  await writeUsers(users, sha)
  console.log(`\n🎉  Done! Added ${added} new faculty. Skipped ${skipped}.`)
  console.log(`   Total users now: ${users.length}\n`)
  console.log('Share these login details with the respective faculty members.')
}

main().catch(e => { console.error(e); process.exit(1) })
