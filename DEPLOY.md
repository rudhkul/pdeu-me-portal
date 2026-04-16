# PDEU ME Portal — Cloudflare Worker Deployment Guide

Complete step-by-step. Takes about 20 minutes total.

---

## Why this exists

Previously, the GitHub PAT (Personal Access Token) was embedded in the
JavaScript bundle — visible to anyone in browser DevTools.

Now, the PAT lives in Cloudflare as an encrypted secret. The browser only
ever talks to the worker. The worker adds the PAT server-side.

```
Before:  Browser → GitHub API (PAT exposed in JS bundle)
After:   Browser → Cloudflare Worker → GitHub API (PAT in Cloudflare vault)
```

---

## Part 1 — Cloudflare Account Setup

### Step 1: Create a Cloudflare account
1. Go to https://cloudflare.com
2. Click **Sign Up** → enter email and password
3. On the plan page select **Free** → Continue
4. You do NOT need to add a domain. Skip that step.

### Step 2: Find your account ID
1. After logging in, go to **Workers & Pages** (left sidebar)
2. On the right side you'll see **Account ID** — copy it
3. Save it somewhere — you'll need it in Step 5

---

## Part 2 — Deploy the Worker

### Step 3: Install Wrangler (Cloudflare's CLI)
Open terminal on your PC:

```bash
npm install -g wrangler
```

### Step 4: Login to Cloudflare via CLI
```bash
wrangler login
```
This opens a browser window. Click **Allow**. Done.

### Step 5: Go to the worker folder
```bash
cd ~/Videos/pdeu-portal/worker
```

### Step 6: Set the secrets (PAT stays here — never in code)

Run each of these one at a time. It will prompt you to type/paste the value:

```bash
wrangler secret put GITHUB_PAT
# Paste your fine-grained PAT (github_pat_...) and press Enter
# The PAT needs: Contents → Read and Write on pdeu-me-data only

wrangler secret put GITHUB_OWNER
# Type: rudhkul

wrangler secret put GITHUB_REPO
# Type: pdeu-me-data

wrangler secret put ALLOWED_ORIGIN
# Type: https://rudhkul.github.io
# (your portal's GitHub Pages URL — no trailing slash)
```

### Step 7: Deploy the worker
```bash
wrangler deploy
```

You'll see output like:
```
✅ Successfully deployed
https://pdeu-me-portal-proxy.rudhkul.workers.dev
```

**Copy that URL.** This is your worker URL.

### Step 8: Test the worker works
Open this URL in your browser (replace with your actual worker URL):
```
https://pdeu-me-portal-proxy.rudhkul.workers.dev/api/health
```

You should see:
```json
{"ok": true}
```

If you see that — the worker is live and working.

---

## Part 3 — Connect the Portal to the Worker

### Step 9: Add GitHub Secret to the portal repo
1. Go to https://github.com/rudhkul/pdeu-me-portal
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `VITE_WORKER_URL`
5. Value: `https://pdeu-me-portal-proxy.rudhkul.workers.dev`
   (use your actual URL from Step 7)
6. Click **Add secret**

### Step 10: Remove the old secrets (they're no longer needed)
In the same GitHub Secrets page, delete these if they exist:
- `VITE_GITHUB_PAT`
- `VITE_DATA_REPO_OWNER`
- `VITE_DATA_REPO_NAME`

The PAT is now in Cloudflare, not GitHub.

### Step 11: Push the updated portal code
```bash
cd ~/Videos/pdeu-portal
git add .
git commit -m "Security: route all GitHub API calls through Cloudflare Worker"
git push origin main
```

GitHub Actions will rebuild and redeploy automatically (~2 minutes).

---

## Part 4 — Verify Everything Works

### Step 12: Test the portal
1. Go to https://rudhkul.github.io/pdeu-me-portal/
2. Log in as an admin
3. Click any tab — data should load
4. Open Chrome DevTools (F12) → Network tab
5. Search for requests — you should see calls to `workers.dev`, NOT to `api.github.com`
6. Click any request → Headers — there is NO Authorization header visible
7. The PAT is completely hidden ✅

---

## Maintenance

### Rotate the PAT (do this yearly)
1. Create a new PAT on GitHub
2. Run: `wrangler secret put GITHUB_PAT`
3. Paste the new PAT
4. Done — no redeployment needed

### Update the worker code
```bash
cd ~/Videos/pdeu-portal/worker
wrangler deploy
```

### Check worker logs (for debugging)
```bash
wrangler tail
```
This streams live logs from the worker.

### Cloudflare free tier limits
- 100,000 requests per day
- 10ms CPU per request
- With 34 faculty, you will never approach these limits

---

## Troubleshooting

**Portal loads but data doesn't appear**
→ Check the worker URL in GitHub Secrets is correct (no trailing slash)
→ Run `wrangler tail` and watch for errors while using the portal

**"Access denied" or CORS error in browser console**
→ Check ALLOWED_ORIGIN secret matches your exact GitHub Pages URL
→ Re-run: `wrangler secret put ALLOWED_ORIGIN`

**Worker shows 401**
→ The PAT may have expired. Create a new one and run `wrangler secret put GITHUB_PAT`

**Worker shows 404**
→ The repo name or owner may be wrong. Check `wrangler secret put GITHUB_OWNER` and `GITHUB_REPO`
