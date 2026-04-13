#!/usr/bin/env node
// Update any user's name, email, or role
// Usage: node scripts/update-user.js

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

async function readUsers() {
  const res  = await fetch(`${API}/users.json`, { headers: HEADERS })
  const meta = await res.json()
  return { users: JSON.parse(Buffer.from(meta.content, 'base64').toString()), sha: meta.sha }
}

async function writeUsers(users, sha) {
  const content = Buffer.from(JSON.stringify(users, null, 2)).toString('base64')
  const res = await fetch(`${API}/users.json`, {
    method: 'PUT', headers: HEADERS,
    body: JSON.stringify({ message: 'portal: update user', content, sha })
  })
  if (!res.ok) throw new Error((await res.json()).message)
}

const rl = readline.createInterface({ input, output })

async function main() {
  console.log('\n✏️   PDEU ME Portal — Update User\n')
  const { users, sha } = await readUsers()

  console.log('Current users:\n')
  users.forEach((u, i) => console.log(`  ${i + 1}. [${u.role.padEnd(7)}] ${u.fullName.padEnd(35)} ${u.email}`))

  const emailToFind = (await rl.question('\nEmail of user to update: ')).trim()
  const idx = users.findIndex(u => u.email.toLowerCase() === emailToFind.toLowerCase())

  if (idx === -1) { console.error(`\n❌  No user with email "${emailToFind}"`); rl.close(); process.exit(1) }

  const u = users[idx]
  console.log(`\nEditing: ${u.fullName} <${u.email}> [${u.role}]`)
  console.log('Press Enter to keep current value.\n')

  const newName  = (await rl.question(`  Full name  [${u.fullName}]: `)).trim()
  const newEmail = (await rl.question(`  Email      [${u.email}]: `)).trim()
  const newRole  = (await rl.question(`  Role       [${u.role}] (faculty/admin): `)).trim()

  users[idx] = {
    ...u,
    fullName: newName  || u.fullName,
    email:    newEmail || u.email,
    role:     (newRole === 'admin' || newRole === 'faculty') ? newRole : u.role,
  }

  await writeUsers(users, sha)
  rl.close()
  console.log(`\n✅  Updated: ${users[idx].fullName} <${users[idx].email}> [${users[idx].role}]\n`)
}

main().catch(e => { console.error(e.message); process.exit(1) })
