/**
 * Auth — talks to the Cloudflare Worker's /api/auth/login endpoint.
 * Worker handles PBKDF2 verification + rate limiting server-side.
 * Browser stores the signed session token in localStorage.
 */

import { sha256 } from 'js-sha256'

const WORKER      = import.meta.env.VITE_WORKER_URL
const SESSION_KEY = 'pdeu_session'
const SECRET      = import.meta.env.VITE_AUTH_SECRET || 'fallback-secret'

// Legacy SHA-256 hash — used by ChangePassword and AdminUsers for existing accounts
export function hashPassword(password, salt) {
  return sha256(SECRET + salt + password)
}
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

// ── Legacy hashPassword — kept for ChangePassword.jsx backward compat ──
// Uses js-sha256, same as before. Existing password hashes remain valid.
import { sha256 } from 'js-sha256'
const AUTH_SECRET = import.meta.env.VITE_AUTH_SECRET || 'fallback-secret'
export function hashPassword(password, salt) {
  return sha256(AUTH_SECRET + salt + password)
}
