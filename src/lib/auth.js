import { sha256 } from 'js-sha256'

const WORKER = (import.meta.env.VITE_WORKER_URL || '').trim().replace(/\/+$/, '')
const SESSION_KEY = 'pdeu_session'
const LEGACY_SECRET = import.meta.env.VITE_AUTH_SECRET || ''

export function hashPassword(password, salt) {
  if (!LEGACY_SECRET) throw new Error('Administrator password management is not configured.')
  return sha256(LEGACY_SECRET + salt + password)
}

async function authRequest(path, options = {}) {
  if (!WORKER) throw new Error('Portal authentication is not configured.')
  let response
  try {
    response = await fetch(`${WORKER}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
  } catch {
    throw new Error('Cannot reach the authentication service.')
  }
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `Authentication failed (${response.status}).`)
  return body
}

export async function login(email, password) {
  const result = await authRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const session = {
    userId: result.userId,
    email: result.email,
    role: result.role,
    fullName: result.fullName,
    token: result.token,
    loginTime: Date.now(),
    exp: result.exp,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    if (!session.token || !session.exp || Date.now() >= session.exp) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return session
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

export function getToken() {
  return getSession()?.token || null
}

export async function changePassword(currentPassword, newPassword) {
  const token = getToken()
  if (!token) throw new Error('Your session has expired. Log in again.')
  return authRequest('/api/auth/change-password', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}
