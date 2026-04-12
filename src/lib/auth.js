import { sha256 } from 'js-sha256'
import { readJSON } from './github'

const SECRET = import.meta.env.VITE_AUTH_SECRET || 'fallback-secret'
const SESSION_KEY = 'pdeu_session'

// ── Password hashing ──────────────────────────────────────────────────
// We hash: sha256(secret + salt + password)
// The salt is per-user and stored in users.json (not secret, just unique)
export function hashPassword(password, salt) {
  return sha256(SECRET + salt + password)
}

// ── Login ─────────────────────────────────────────────────────────────
export async function login(email, password) {
  let users
  try {
    const res = await readJSON('users.json')
    users = res.data
  } catch {
    throw new Error('Cannot reach data repository. Check your connection and try again.')
  }

  if (!users || users.length === 0) {
    throw new Error('No users found. Please run the init-repo script first.')
  }

  const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!user) throw new Error('No account found with that email address.')

  const hash = hashPassword(password, user.salt)
  if (hash !== user.passwordHash) throw new Error('Incorrect password.')

  const session = {
    userId:   user.id,
    email:    user.email,
    role:     user.role,
    fullName: user.fullName,
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

// ── Session management ────────────────────────────────────────────────
export function getSession() {
  const s = sessionStorage.getItem(SESSION_KEY)
  return s ? JSON.parse(s) : null
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY)
}
