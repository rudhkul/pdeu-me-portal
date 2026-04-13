#!/usr/bin/env node
// Reset passwords for ALL 5 admins interactively
// Usage: node scripts/reset-admins.js
// Same env vars as init-repo.js

import { createHash } from 'crypto'
import * as readline from 'readline/promises'
import { stdin as input, stdout as output } from 'process'

const OWNER  = process.env.DATA_REPO_OWNER
const REPO   = process.env.DATA_REPO_NAME
const PAT    = process.env.GITHUB_PAT
const SECRET = process.env.AUTH_SECRET

if (!OWNER || !REPO || !PAT || !SECRET) {
  console.error('❌  Set DATA_REPO_OWNER, DATA_REPO_NAME, GITHUB_PAT, AUTH_SECRET')
  process.exit(1)
}

const API     = `https://api.github.com/repos/${OWNER}/${REPO}/contents`
const HEADERS = { Authorization: `Bearer ${PAT}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }

function hash(pwd, salt) {
  return createHash('sha256').update(SECRET + salt + pwd).digest('hex')
}

async function readUsers() {
  const res  = await fetch(`${API}/users.json`, { headers: HEADERS })
  const meta = await res.json()
  return { users: JSON.parse(Buffer.from(meta.content, 'base64').toString()), sha: meta.sha }
}

async function writeUsers(users, sha) {
  const content = Buffer.from(JSON.stringify(users, null, 2)).toString('base64')
  const res = await fetch(`${API}/users.json`, {
    method: 'PUT', headers: HEADERS,
    body: JSON.stringify({ message: 'portal: reset admin passwords', content, sha })
  })
  if (!res.ok) throw new Error((await res.json()).message)
}

const rl = readline.createInterface({ input, output })

async function main() {
  console.log('\n🔑  PDEU ME Portal — Reset Admin Passwords\n')

  const { users, sha } = await readUsers()
  const admins = users.filter(u => u.role === 'admin')

  if (!admins.length) { console.log('No admin users found.'); rl.close(); return }

  console.log(`Found ${admins.length} admin(s):\n`)
  admins.forEach(a => console.log(`  • ${a.fullName} <${a.email}>`))
  console.log('\nEnter new password for each. Press Enter to SKIP (keep existing password).\n')

  let changed = 0
  for (const admin of admins) {
    const pwd = (await rl.question(`  New password for ${admin.fullName}: `)).trim()
    if (!pwd) { console.log(`    ⏭  Skipped\n`); continue }
    if (pwd.length < 6) { console.log(`    ⚠️  Too short — skipped\n`); continue }
    const idx = users.findIndex(u => u.id === admin.id)
    users[idx] = { ...users[idx], passwordHash: hash(pwd, admin.salt) }
    console.log(`    ✅  Updated\n`)
    changed++
  }

  rl.close()
  if (!changed) { console.log('No passwords changed.'); return }
  await writeUsers(users, sha)
  console.log(`\n✅  ${changed} admin password${changed !== 1 ? 's' : ''} reset successfully.\n`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
