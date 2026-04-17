/**
 * Auth — talks to the Cloudflare Worker's /api/auth/login endpoint.
 * Worker handles PBKDF2 verification + rate limiting server-side.
 * Browser stores the signed session token in localStorage.
 */

const WORKER      = import.meta.env.VITE_WORKER_URL
const SESSION_KEY = 'pdeu_session'
const SESSION_TTL = 8 * 60 * 60 * 1000   // 8 hours (matches worker)

export async function login(email, password) {
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

  if (!res.ok) {
    // Pass through the worker's error message (includes rate limit info)
    throw new Error(data.error || 'Login failed.')
  }

  const session = {
    userId:    data.userId,
    email:     data.email,
    role:      data.role,
    fullName:  data.fullName,
    token:     data.token,       // signed by worker, used for write auth
    loginTime: Date.now(),
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

export function getToken() {
  return getSession()?.token || null
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}
