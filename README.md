# ME Department Data Portal — PDEU
### 100% Free · GitHub Pages + GitHub API · No paid services

---

## How it works

```
Faculty opens browser
        ↓
  GitHub Pages          ← React app (your public repo, free)
  (static website)
        ↓
  GitHub API            ← reads & writes JSON files (your private repo, free)
  (private data repo)
        ↓
  Admin opens browser
  Same GitHub Pages app — sees ALL faculty data, exports Excel
```

**Data storage:** Every form submission is saved as a JSON file inside a **private** GitHub repository. There is no database, no server, no subscription — just files in a repo.

**Auth:** A `users.json` file in the private repo holds usernames and SHA-256 hashed passwords. Login fetches this file and verifies locally.

**File uploads:** Faculty paste their OneDrive sharing link into the form. No API needed — they generate the link themselves from their institutional OneDrive.

---

## Prerequisites

- A GitHub account (free)
- Node.js 18+ installed on your computer (for the setup scripts)
- Your faculty have institutional email addresses

---

## Step 1 — Create two GitHub repositories

### Repo A: Portal code (public)
1. Go to github.com → **New repository**
2. Name: `pdeu-me-portal` (or any name you like)
3. Visibility: **Public** *(required for free GitHub Pages)*
4. Click **Create repository**

### Repo B: Data storage (private)
1. Go to github.com → **New repository**
2. Name: `pdeu-me-data`
3. Visibility: **Private** *(your data stays private)*
4. ✅ Check **Add a README file** *(so the repo isn't empty)*
5. Click **Create repository**

---

## Step 2 — Create a GitHub Personal Access Token (PAT)

This token lets the portal read and write files in your private data repo.

1. Go to **GitHub → Settings → Developer settings → Fine-grained personal access tokens**
2. Click **Generate new token**
3. Fill in:
   - **Token name:** `PDEU ME Portal`
   - **Expiration:** 1 year (or No expiration)
   - **Resource owner:** your org or personal account
   - **Repository access:** Only select repositories → choose `pdeu-me-data`
4. Under **Repository permissions:**
   - **Contents:** Read and write
   - Everything else: No access
5. Click **Generate token** → **Copy it immediately** (you won't see it again)

---

## Step 3 — Clone and configure the portal

```bash
git clone https://github.com/YOUR_USERNAME/pdeu-me-portal.git
cd pdeu-me-portal
npm install
```

Copy the environment file:
```bash
cp .env.example .env
```

Edit `.env` and fill in your values:
```env
VITE_DATA_REPO_OWNER=your-github-username-or-org
VITE_DATA_REPO_NAME=pdeu-me-data
VITE_GITHUB_PAT=github_pat_xxxxxxxxxxxxxxxxxxxx
VITE_AUTH_SECRET=any-long-random-string-you-make-up
```

> **Generate a good AUTH_SECRET:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## Step 4 — Initialise the data repository

This script creates the folder structure in `pdeu-me-data` and sets up the 5 admin users.

Run it once from your terminal:

```bash
# Set env vars for the script (Linux/macOS)
export DATA_REPO_OWNER=your-github-username
export DATA_REPO_NAME=pdeu-me-data
export GITHUB_PAT=github_pat_xxxxxxxxxxxxxxxxxxxx
export AUTH_SECRET=the-same-secret-you-used-in-.env

node scripts/init-repo.js
```

**On Windows (Command Prompt):**
```cmd
set DATA_REPO_OWNER=your-github-username
set DATA_REPO_NAME=pdeu-me-data
set GITHUB_PAT=github_pat_xxxxxxxxxxxxxxxxxxxx
set AUTH_SECRET=the-same-secret-you-used-in-.env
node scripts\init-repo.js
```

The script will:
- Ask for an email and password for each of the 5 admins (Salman, Krunal, Vivek Jaiswal, Anirudh, Abhinaya)
- Hash the passwords (the plain-text passwords are never stored anywhere)
- Create `users.json` in your private data repo
- Create the folder structure for all 20 data tabs

---

## Step 5 — Add faculty users

Run this for each faculty member who needs access:

```bash
node scripts/add-user.js
```

It will ask for:
- Full name (exactly as it should appear in data exports)
- Email address
- Role: `faculty`
- A temporary password (ask the faculty to change it... or set a standard one)

You can run this script any time to add more faculty later.

---

## Step 6 — Update the repo name in vite.config.js

Open `vite.config.js` and change `pdeu-me-portal` to your actual repo name:

```js
export default defineConfig({
  plugins: [react()],
  base: '/your-actual-repo-name/',   // ← change this
})
```

Do the same in `src/App.jsx`:
```jsx
<BrowserRouter basename="/your-actual-repo-name/">
```

---

## Step 7 — Push code to GitHub and deploy

```bash
git add .
git commit -m "Initial portal setup"
git push origin main
```

### Enable GitHub Pages:
1. Go to your `pdeu-me-portal` repo → **Settings → Pages**
2. Source: **GitHub Actions**
3. That's it — the deploy workflow runs automatically

### Add secrets for the build:
Go to your portal repo → **Settings → Secrets and variables → Actions → New repository secret**

Add all four:

| Secret Name | Value |
|---|---|
| `VITE_DATA_REPO_OWNER` | Your GitHub username/org |
| `VITE_DATA_REPO_NAME` | `pdeu-me-data` |
| `VITE_GITHUB_PAT` | Your PAT from Step 2 |
| `VITE_AUTH_SECRET` | Your auth secret |

Once secrets are added, go to **Actions → Deploy to GitHub Pages → Run workflow** to trigger the first deploy.

Your portal will be live at:
**`https://YOUR_USERNAME.github.io/pdeu-me-portal/`**

---

## Day-to-day usage

### Faculty
1. Open the portal URL
2. Log in with their email and temporary password
3. Click any of the 20 tabs from the dashboard
4. Fill in the form and click **Save**
5. For file attachments: upload the file to their OneDrive → right-click → Share → Copy link → paste in the form

### Admins
1. Log in — land on admin dashboard
2. See entry counts per tab, filterable by admin ownership
3. Click any tab → view all faculty submissions with filters (name, year, search)
4. Click any row to expand full details
5. **Quick Export:** Download all data for a tab instantly
6. **Export Builder:** Choose columns, drag to reorder, filter by faculty/year, preview, download

---

## Adding a faculty member after launch

```bash
node scripts/add-user.js
```

No redeployment needed. The new user can log in immediately.

---

## How data is stored

```
pdeu-me-data/                         ← private repo
├── users.json                        ← all users (hashed passwords)
└── records/
    ├── tab1/
    │   ├── usr_a1b2c3d4.json         ← Prof. Surendra's Tab 1 data
    │   └── usr_e5f6g7h8.json         ← Dr. Nagababu's Tab 1 data
    ├── tab2/
    │   ├── usr_a1b2c3d4.json
    │   └── ...
    └── tab20/
        └── ...
```

Each `<userId>.json` file contains an array of records for that faculty in that tab. Faculty can only write to files matching their user ID (enforced by the write logic — each write path is `records/<tabId>/<userId>.json`).

---

## Security notes

This is an internal institutional tool, not a public-facing application. The trade-offs made are appropriate for this use case:

- **The GitHub PAT is embedded in the built JavaScript bundle.** It has the minimum permissions possible: read/write only to the private data repo. Anyone who extracts the PAT can read/write academic submission data — but not access any other GitHub resource, and not access your institution's systems.
- **Passwords are hashed** with SHA-256 (secret + salt + password). Plain-text passwords are never stored or transmitted.
- **The data repo is private.** Submissions cannot be read by the public.
- **Sessions are stored in sessionStorage** — cleared when the browser tab closes.

For a department data collection tool with 20–30 known faculty members, this is an acceptable security posture. If you need stronger guarantees in the future, the codebase can be migrated to Supabase (free tier) or Firebase (free tier) with minimal changes.

---

## Troubleshooting

**Login fails with "Cannot reach data repository"**
- Check that `VITE_GITHUB_PAT` is correct and not expired
- Check that `VITE_DATA_REPO_OWNER` and `VITE_DATA_REPO_NAME` exactly match the private repo

**Login fails with "No users found"**
- Run `node scripts/init-repo.js` — the data repo may not be initialised

**"GitHub write failed (409)"**
- This is a conflict error — two writes happened simultaneously. Just try again.

**GitHub Pages shows blank page**
- Check that `base` in `vite.config.js` matches your repo name exactly
- Check that all 4 secrets are set in GitHub repo Settings

**Saving is slow (3–5 seconds)**
- Normal — the GitHub API requires a read + write for each save. This is the trade-off for using GitHub as a database.

**GitHub Actions build fails**
- Check that all 4 secrets are set
- Verify Node.js version in workflow is 20+

---

## Tab → Admin ownership

| Tab | Admin |
|---|---|
| 1. Faculty Information | Salman |
| 2. Faculty & Student Achievements | Krunal |
| 3. Faculty Subject Mapping | Vivek Jaiswal |
| 4. PhD Student Details | Salman |
| 5. Publications & Conferences | Anirudh |
| 6. Projects & Consultancy | Anirudh |
| 7. Patents & Prototypes | Anirudh |
| 8. Meetings, Alumni & Parent | Abhinaya |
| 9. Talks, Workshops, STTP, FDP | Abhinaya |
| 10. Professional Memberships | Abhinaya |
| 11. Faculty Certifications / MOOCs | Vivek Jaiswal |
| 12. e-Content Developed | Vivek Jaiswal |
| 13. Faculty Support in Student Projects | Krunal |
| 14. Faculty Training & Collaboration | Abhinaya |
| 15. Faculty as Resource Persons | Abhinaya |
| 16. Industrial Visits | Salman |
| 17. Academic Courses in Innovation | Vivek Jaiswal |
| 18. Placement Data | Krunal |
| 19. MOU Details | Anirudh |
| 20. Internal Research Grants | Anirudh |

---

## Tech stack — everything free and open source

| Layer | Technology | Cost |
|---|---|---|
| Frontend framework | React 18 + Vite | Free |
| Styling | Tailwind CSS | Free |
| Routing | React Router v6 | Free |
| Forms | React Hook Form | Free |
| Password hashing | js-sha256 | Free |
| Drag & drop | @dnd-kit | Free |
| Excel export | SheetJS (xlsx) | Free |
| Hosting | GitHub Pages | Free |
| CI/CD | GitHub Actions | Free |
| Database | GitHub API + private repo | Free |
| Auth | Custom (SHA-256 + sessions) | Free |
| **Total** | | **₹0 / month** |
