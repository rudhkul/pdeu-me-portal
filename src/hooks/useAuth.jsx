import { createContext, useContext, useState, useEffect } from 'react'
import { login as authLogin, logout as authLogout, getSession } from '../lib/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const s = getSession()
    setSession(s)
    setLoading(false)
  }, [])

  async function signIn(email, password) {
    const s = await authLogin(email, password)   // throws on failure
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
