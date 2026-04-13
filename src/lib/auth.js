import { sha256 } from 'js-sha256'
import { readJSON } from './github'

const SECRET      = import.meta.env.VITE_AUTH_SECRET || 'fallback-secret'
const SESSION_KEY  = 'pdeu_session'
const SESSION_TTL  = 8 * 60 * 60 * 1000   // 8 hours

export function hashPassword(password, salt) {
  return sha256(SECRET + salt + password)
}

export async function login(email, password) {
  let users
  try {
    const res = await readJSON('users.json')
    users = res.data
  } catch (e) {
    // Provide helpful error if PAT has expired
    if (e.message?.includes('401') || e.message?.includes('Bad credentials')) {
      throw new Error('Authentication token has expired. Please contact the administrator.')
    }
    throw new Error('Cannot reach data repository. Check your connection and try again.')
  }

  if (!users || users.length === 0)
    throw new Error('No users found. Please run the init-repo script first.')

  const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!user) throw new Error('No account found with that email address.')

  const hash = hashPassword(password, user.salt)
  if (hash !== user.passwordHash) throw new Error('Incorrect password.')

  const session = {
    userId:    user.id,
    email:     user.email,
    role:      user.role,
    fullName:  user.fullName,
    loginTime: Date.now(),
  }
  // localStorage so session survives opening new tabs
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function getSession() {
  const s = localStorage.getItem(SESSION_KEY)
  if (!s) return null
  const session = JSON.parse(s)
  // Check TTL
  if (Date.now() - session.loginTime > SESSION_TTL) {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
  return session
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}
