#!/usr/bin/env node
// One-time fix: creates meta/settings.json in the data repo
// Run this if the Deadline feature shows errors
// Usage: node scripts/fix-meta.js

const OWNER  = process.env.DATA_REPO_OWNER
const REPO   = process.env.DATA_REPO_NAME
const PAT    = process.env.GITHUB_PAT

if (!OWNER || !REPO || !PAT) {
  console.error('❌  Set DATA_REPO_OWNER, DATA_REPO_NAME, GITHUB_PAT')
  process.exit(1)
}

const API     = `https://api.github.com/repos/${OWNER}/${REPO}/contents`
const HEADERS = { Authorization: `Bearer ${PAT}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }

async function fileExists(path) {
  const res = await fetch(`${API}/${path}`, { headers: HEADERS })
  return res.status !== 404
}

async function createFile(path, data) {
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64')
  const res = await fetch(`${API}/${path}`, {
    method: 'PUT', headers: HEADERS,
    body: JSON.stringify({ message: `init: create ${path}`, content })
  })
  if (!res.ok) throw new Error((await res.json()).message)
}

async function main() {
  console.log('\n🔧  PDEU ME Portal — Fix Meta Files\n')

  if (await fileExists('meta/settings.json')) {
    console.log('  ✅  meta/settings.json already exists — no action needed.')
  } else {
    await createFile('meta/settings.json', { deadline: '', message: '' })
    console.log('  ✅  Created meta/settings.json')
  }

  // Also ensure .gitkeep exists in each tab directory
  const TABS = ['tab1','tab2','tab3','tab4','tab5','tab6','tab7','tab8','tab9','tab10',
                'tab11','tab12','tab13','tab14','tab15','tab16','tab17','tab18','tab19','tab20']

  for (const tabId of TABS) {
    const path = `records/${tabId}/.gitkeep`
    if (!(await fileExists(path))) {
      await createFile(path, [])
      console.log(`  ✅  Created ${path}`)
    }
  }

  console.log('\n✅  All done!\n')
}

main().catch(e => { console.error(e.message); process.exit(1) })
