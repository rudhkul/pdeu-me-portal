import { createContext, useContext, useState, useEffect } from 'react'
import { login as authLogin, logout as authLogout, getSession } from '../lib/auth'

const AuthContext = createContext(null)

// Session timeout: 8 hours in milliseconds
const SESSION_TTL = 8 * 60 * 60 * 1000

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const s = getSession()
    setSession(s)
    setLoading(false)
  }, [])

  // Auto-expire session after TTL
  useEffect(() => {
    if (!session) return
    const expiry = session.loginTime + SESSION_TTL
    const remaining = expiry - Date.now()
    if (remaining <= 0) { signOut(); return }

    const timer = setTimeout(() => {
      signOut()
      // Show message after signout redirect
      sessionStorage.setItem('session_expired', '1')
    }, remaining)

    return () => clearTimeout(timer)
  }, [session])

  async function signIn(email, password) {
    const s = await authLogin(email, password)
    setSession(s)
    return s
  }

  function signOut() {
    authLogout()
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
