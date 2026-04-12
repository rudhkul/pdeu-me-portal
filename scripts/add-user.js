#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// add-user.js  — Add a new faculty or admin user
// Usage: node scripts/add-user.js
//
// Same env vars as init-repo.js
// ─────────────────────────────────────────────────────────────

import { createHash, randomBytes } from 'crypto'
import * as readline from 'readline/promises'
import { stdin as input, stdout as output } from 'process'

const OWNER  = process.env.DATA_REPO_OWNER
const REPO   = process.env.DATA_REPO_NAME
const PAT    = process.env.GITHUB_PAT
const SECRET = process.env.AUTH_SECRET

if (!OWNER || !REPO || !PAT || !SECRET) {
  console.error('❌  Missing env vars.')
  process.exit(1)
}

const API     = `https://api.github.com/repos/${OWNER}/${REPO}/contents`
const HEADERS = { Authorization: `Bearer ${PAT}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }

function hashPassword(p, salt) {
  return createHash('sha256').update(SECRET + salt + p).digest('hex')
}

async function readUsers() {
  const res  = await fetch(`${API}/users.json`, { headers: HEADERS })
  if (res.status === 404) return { users: [], sha: null }
  const meta = await res.json()
  return { users: JSON.parse(Buffer.from(meta.content, 'base64').toString()), sha: meta.sha }
}

async function writeUsers(users, sha) {
  const content = Buffer.from(JSON.stringify(users, null, 2)).toString('base64')
  const body    = { message: 'portal: add user', content, ...(sha ? { sha } : {}) }
  const res     = await fetch(`${API}/users.json`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) })
  if (!res.ok) { const j = await res.json(); throw new Error(j.message) }
}

const rl = readline.createInterface({ input, output })

async function main() {
  console.log('\n👤  PDEU ME Portal — Add User\n')

  const fullName = (await rl.question('Full name (as it will appear in data): ')).trim()
  const email    = (await rl.question('Email address: ')).trim()
  const roleRaw  = (await rl.question('Role [faculty/admin] (default: faculty): ')).trim()
  const role     = roleRaw === 'admin' ? 'admin' : 'faculty'
  const password = (await rl.question('Temporary password: ')).trim()

  rl.close()

  const { users, sha } = await readUsers()
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    console.error(`\n❌  A user with email "${email}" already exists.`)
    process.exit(1)
  }

  const salt = randomBytes(16).toString('hex')
  users.push({
    id:           `usr_${randomBytes(8).toString('hex')}`,
    fullName,
    email,
    role,
    salt,
    passwordHash: hashPassword(password, salt),
  })

  await writeUsers(users, sha)
  console.log(`\n✅  ${role === 'admin' ? 'Admin' : 'Faculty'} "${fullName}" added successfully!`)
  console.log(`   They can log in at the portal with email: ${email}\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
