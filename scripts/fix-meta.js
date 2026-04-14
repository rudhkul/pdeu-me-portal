#!/usr/bin/env node
// Run once to create meta/settings.json in the data repo
// Needed for DeadlineManager and NotificationSettings to work
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

async function main() {
  console.log('\n🔧  Creating meta/settings.json in data repo…')

  // Check if already exists
  const check = await fetch(`${API}/meta/settings.json`, { headers: HEADERS })
  if (check.ok) {
    console.log('✅  meta/settings.json already exists — nothing to do.\n')
    return
  }

  const content = Buffer.from(JSON.stringify({
    deadline: '',
    message: '',
    notifications_enabled: true,
  }, null, 2)).toString('base64')

  const res = await fetch(`${API}/meta/settings.json`, {
    method: 'PUT',
    headers: HEADERS,
    body: JSON.stringify({ message: 'init: create meta/settings.json', content }),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.message)
  }

  console.log('✅  Created meta/settings.json\n')
  console.log('The deadline manager and notification settings will now work correctly.\n')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })
