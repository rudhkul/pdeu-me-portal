import { createContext, useContext, useState, useEffect } from 'react'
import { login as authLogin, logout as authLogout, getSession } from '../lib/auth'

const AuthContext = createContext(null)

const SESSION_TTL = 8 * 60 * 60 * 1000   // 8 hours
const VIEW_KEY    = 'pdeu_view_mode'

export function AuthProvider({ children }) {
  const [session,   setSession]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  // viewMode: 'admin' | 'faculty' — only relevant for admin users
  const [viewMode,  setViewMode]  = useState(() => localStorage.getItem(VIEW_KEY) || 'admin')

  useEffect(() => {
    const s = getSession()
    setSession(s)
    setLoading(false)
  }, [])

  // Auto-expire session
  useEffect(() => {
    if (!session) return
    const remaining = (session.loginTime + SESSION_TTL) - Date.now()
    if (remaining <= 0) { signOut(); return }
    const t = setTimeout(() => {
      signOut()
      sessionStorage.setItem('session_expired', '1')
    }, remaining)
    return () => clearTimeout(t)
  }, [session])

  async function signIn(email, password) {
    const s = await authLogin(email, password)
    setSession(s)
    // Admins default to admin mode on fresh login
    if (s.role === 'admin') {
      setViewMode('admin')
      localStorage.setItem(VIEW_KEY, 'admin')
    }
    return s
  }

  function signOut() {
    authLogout()
    setSession(null)
  }

  function switchView(mode) {
    setViewMode(mode)
    localStorage.setItem(VIEW_KEY, mode)
  }

  // Effective role: what the UI should treat this session as
  // Admin in faculty mode → behaves like 'faculty' for routing purposes
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
