import { sha256 } from 'js-sha256'
import { readJSON } from './github'

const WORKER      = import.meta.env.VITE_WORKER_URL
const SECRET      = import.meta.env.VITE_AUTH_SECRET || 'fallback-secret'
const SESSION_KEY = 'pdeu_session'
const SESSION_TTL = 8 * 60 * 60 * 1000

// SHA-256 hash — used by ChangePassword and AdminUsers
export function hashPassword(password, salt) {
  return sha256(SECRET + salt + password)
}

export async function login(email, password) {
  // Try worker login first (new path)
  if (WORKER) {
    let res
    try {
      res = await fetch(`${WORKER}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })
    } catch {
      throw new Error('Cannot reach the server. Check your connection and try again.')
    }
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed.')
    const session = {
      userId:    data.userId,
      email:     data.email,
      role:      data.role,
      fullName:  data.fullName,
      token:     data.token,
      loginTime: Date.now(),
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
  }

  // Fallback: direct GitHub check (original path)
  const { data: users } = await readJSON('users.json')
  if (!users?.length) throw new Error('No users found. Please run the init-repo script first.')
  const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!user) throw new Error('No account found with that email address.')
  if (hashPassword(password, user.salt) !== user.passwordHash)
    throw new Error('Incorrect password.')
  const session = {
    userId: user.id, email: user.email, role: user.role,
    fullName: user.fullName, loginTime: Date.now(),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function getSession() {
  try {
    const s = localStorage.getItem(SESSION_KEY)
    if (!s) return null
    const session = JSON.parse(s)
    if (Date.now() - session.loginTime > SESSION_TTL) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch { return null }
}

export function getToken() { return getSession()?.token || null }
export function logout()   { localStorage.removeItem(SESSION_KEY) }
