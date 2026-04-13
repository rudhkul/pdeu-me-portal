#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// init-repo.js
// Run ONCE to set up the private data repository.
// Usage: node scripts/init-repo.js
//
// Prerequisites:
//   1. Create a private GitHub repo (e.g. "pdeu-me-data")
//   2. Create a fine-grained PAT with Contents: Read & Write on that repo
//   3. Set env vars in your shell:
//        export DATA_REPO_OWNER=your-org
//        export DATA_REPO_NAME=pdeu-me-data
//        export GITHUB_PAT=github_pat_xxxx
//        export AUTH_SECRET=your-random-secret
// ─────────────────────────────────────────────────────────────

import { createHash, randomBytes } from 'crypto'
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

async function writeFile(path, data, sha = null) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64')
  const body    = { message: `init: create ${path}`, content, ...(sha ? { sha } : {}) }
  const res     = await fetch(`${API}/${path}`, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) })
  const json    = await res.json()
  if (!res.ok) throw new Error(json.message || `Write failed: ${res.status}`)
  return json
}

async function fileExists(path) {
  const res = await fetch(`${API}/${path}`, { headers: HEADERS })
  if (res.status === 404) return { exists: false, sha: null }
  const json = await res.json()
  return { exists: true, sha: json.sha }
}

async function createPlaceholder(path) {
  const { exists } = await fileExists(path)
  if (exists) { console.log(`  ⏭  ${path} already exists`); return }
  await writeFile(path, [])
  console.log(`  ✅  Created ${path}`)
}

const rl = readline.createInterface({ input, output })

async function promptPassword(name) {
  const pwd = await rl.question(`   Password for ${name}: `)
  return pwd.trim()
}

// ── Admin users to create ─────────────────────────────────────
const ADMIN_NAMES = ['Salman', 'Krunal', 'Vivek Jaiswal', 'Anirudh', 'Abhinava']

// ── Tab IDs (must match src/config/tabs.js) ───────────────────
const TAB_IDS = [
  'tab1','tab2','tab3','tab4','tab5','tab6','tab7','tab8','tab9','tab10',
  'tab11','tab12','tab13','tab14','tab15','tab16','tab17','tab18','tab19','tab20',
]

async function main() {
  console.log('\n🎓  PDEU ME Portal — Data Repository Initialiser')
  console.log('='.repeat(52))
  console.log(`Repository: ${OWNER}/${REPO}\n`)

  // ── Step 1: Check if users.json exists ───────────────────────
  const { exists: usersExist, sha: usersSha } = await fileExists('users.json')
  let existingUsers = []

  if (usersExist) {
    const res  = await fetch(`${API}/users.json`, { headers: HEADERS })
    const meta = await res.json()
    existingUsers = JSON.parse(Buffer.from(meta.content, 'base64').toString())
    console.log(`Found existing users.json with ${existingUsers.length} users.`)
  }

  // ── Step 2: Create admin users ────────────────────────────────
  console.log('\n📋  Setting up admin users. Enter a password for each:\n')
  const newUsers = [...existingUsers]

  for (const name of ADMIN_NAMES) {
    const alreadyExists = existingUsers.find(u => u.fullName === name && u.role === 'admin')
    if (alreadyExists) {
      console.log(`  ⏭  Admin "${name}" already exists — skipping`)
      continue
    }
    const email    = await rl.question(`   Email for ${name}: `)
    const password = await promptPassword(name)
    const salt     = randomBytes(16).toString('hex')
    newUsers.push({
      id:           `usr_${randomBytes(8).toString('hex')}`,
      fullName:     name,
      email:        email.trim(),
      role:         'admin',
      salt,
      passwordHash: hashPassword(password, salt),
    })
    console.log(`  ✅  Added admin: ${name}\n`)
  }

  // ── Step 3: Save users.json ───────────────────────────────────
  await writeFile('users.json', newUsers, usersExist ? usersSha : null)
  console.log('\n✅  users.json saved\n')

  // ── Step 4: Create meta/settings.json ────────────────────────
  const { exists: metaExists } = await fileExists('meta/settings.json')
  if (!metaExists) {
    await writeFile('meta/settings.json', { deadline: '', message: '' })
    console.log('✅  Created meta/settings.json\n')
  } else {
    console.log('⏭  meta/settings.json already exists\n')
  }

  // ── Step 5: Create placeholder record files for each tab ──────
  console.log('📁  Creating tab record directories…')
  for (const tabId of TAB_IDS) {
    await createPlaceholder(`records/${tabId}/.gitkeep`)
  }

  rl.close()
  console.log('\n🎉  Done! Your data repository is ready.')
  console.log(`\nNext: add faculty via "node scripts/add-user.js"\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
