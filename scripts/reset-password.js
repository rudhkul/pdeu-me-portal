#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// reset-password.js  — Admin resets a user's password
// Usage: node scripts/reset-password.js
//
// Same env vars as init-repo.js
// ─────────────────────────────────────────────────────────────

import { createHash } from 'crypto'
import * as readline from 'readline/promises'
import { stdin as input, stdout as output } from 'process'

const OWNER  = process.env.DATA_REPO_OWNER
const REPO   = process.env.DATA_REPO_NAME
const PAT    = process.env.GITHUB_PAT
const SECRET = process.env.AUTH_SECRET

if (!OWNER || !REPO || !PAT || !SECRET) {
  console.error('❌  Missing env vars. Set DATA_REPO_OWNER, DATA_REPO_NAME, GITHUB_PAT, AUTH_SECRET')
  process.exit(1)
}

const API     = `https://api.github.com/repos/${OWNER}/${REPO}/contents`
const HEADERS = {
  Authorization:  `Bearer ${PAT}`,
  Accept:         'application/vnd.github.v3+json',
  'Content-Type': 'application/json',
}

function hashPassword(password, salt) {
  return createHash('sha256').update(SECRET + salt + password).digest('hex')
}

async function readUsers() {
  const res  = await fetch(`${API}/users.json`, { headers: HEADERS })
  if (res.status === 404) { console.error('❌  users.json not found. Run init-repo.js first.'); process.exit(1) }
  const meta = await res.json()
  return { users: JSON.parse(Buffer.from(meta.content, 'base64').toString()), sha: meta.sha }
}

async function writeUsers(users, sha) {
  const content = Buffer.from(JSON.stringify(users, null, 2)).toString('base64')
  const body    = { message: 'portal: reset password', content, sha }
  const res     = await fetch(`${API}/users.json`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) })
  if (!res.ok) { const j = await res.json(); throw new Error(j.message) }
}

const rl = readline.createInterface({ input, output })

async function main() {
  console.log('\n🔑  PDEU ME Portal — Reset User Password\n')

  const { users, sha } = await readUsers()

  // List all users
  console.log('Current users:')
  users.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.fullName} <${u.email}> [${u.role}]`)
  })

  const email = (await rl.question('\nEmail of user to reset: ')).trim()
  const user  = users.find(u => u.email.toLowerCase() === email.toLowerCase())

  if (!user) {
    console.error(`\n❌  No user found with email "${email}"`)
    rl.close()
    process.exit(1)
  }

  console.log(`\nResetting password for: ${user.fullName} (${user.role})`)
  const newPassword = (await rl.question('New password (min 6 chars): ')).trim()
  rl.close()

  if (newPassword.length < 6) {
    console.error('❌  Password too short.')
    process.exit(1)
  }

  const newHash = hashPassword(newPassword, user.salt)
  const updated = users.map(u =>
    u.email.toLowerCase() === email.toLowerCase()
      ? { ...u, passwordHash: newHash }
      : u
  )

  await writeUsers(updated, sha)
  console.log(`\n✅  Password reset for ${user.fullName}`)
  console.log(`   They can now log in with: ${email}`)
  console.log(`   New password: ${newPassword}\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
