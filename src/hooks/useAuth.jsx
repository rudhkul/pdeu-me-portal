import { createContext, useContext, useState, useEffect } from 'react'
import { login as authLogin, logout as authLogout, getSession } from '../lib/auth'
import toast from 'react-hot-toast'

const AuthContext = createContext(null)
const SESSION_TTL    = 8 * 60 * 60 * 1000   // 8 hours
const WARNING_BEFORE = 15 * 60 * 1000       // warn 15 min before expiry
const VIEW_KEY       = 'pdeu_view_mode'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState(() => localStorage.getItem(VIEW_KEY) || 'admin')

  useEffect(() => {
    const s = getSession()
    setSession(s)

    if (s?.role === 'admin') {
      const storedMode = localStorage.getItem(VIEW_KEY)
      const nextMode = storedMode === 'faculty' ? 'faculty' : 'admin'
      setViewMode(nextMode)
      localStorage.setItem(VIEW_KEY, nextMode)
    } else {
      setViewMode('faculty')
    }

    setLoading(false)
  }, [])

  useEffect(() => {
    if (!session) return

    const expiry = session.loginTime + SESSION_TTL
    const warnAt = expiry - WARNING_BEFORE
    const now = Date.now()

    const warnDelay = warnAt - now
    let warnTimer
    let logoutTimer

    if (warnDelay > 0) {
      warnTimer = setTimeout(() => {
        toast('⏰ Your session expires in 15 minutes. Save your work and log in again to continue.', {
          duration: 10000,
          icon: '⚠️',
        })
      }, warnDelay)
    }

    const logoutDelay = expiry - now
    if (logoutDelay > 0) {
      logoutTimer = setTimeout(() => {
        authLogout()
        setSession(null)
        setViewMode('admin')
        localStorage.removeItem(VIEW_KEY)
        sessionStorage.setItem('session_expired', '1')
        window.location.hash = '/login'
      }, logoutDelay)
    } else {
      authLogout()
      setSession(null)
      setViewMode('admin')
      localStorage.removeItem(VIEW_KEY)
    }

    return () => {
      clearTimeout(warnTimer)
      clearTimeout(logoutTimer)
    }
  }, [session])

  async function signIn(email, password) {
    const s = await authLogin(email, password)
    setSession(s)

    if (s.role === 'admin') {
      setViewMode('admin')
      localStorage.setItem(VIEW_KEY, 'admin')
    } else {
      setViewMode('faculty')
      localStorage.removeItem(VIEW_KEY)
    }

    return s
  }

  function signOut() {
    authLogout()
    setSession(null)
    setViewMode('admin')
    localStorage.removeItem(VIEW_KEY)
  }

  function switchView(mode) {
    if (session?.role !== 'admin') return
    const nextMode = mode === 'faculty' ? 'faculty' : 'admin'
    setViewMode(nextMode)
    localStorage.setItem(VIEW_KEY, nextMode)
  }

  const effectiveRole = session?.role === 'admin' && viewMode === 'faculty'
    ? 'faculty'
    : session?.role

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut, viewMode, switchView, effectiveRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
