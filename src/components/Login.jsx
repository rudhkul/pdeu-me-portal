import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export default function Login() {
  const { signIn }  = useAuth()
  const navigate    = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [showPwd,  setShowPwd]  = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('session_expired')) {
      toast('Your session expired. Please log in again.', { icon: '⏰' })
      sessionStorage.removeItem('session_expired')
    }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const session = await signIn(email, password)
      navigate(session.role === 'admin' ? '/admin' : '/faculty', { replace: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#003087] via-blue-800 to-[#1F4AA8] dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4">
        <img
          src="/dic-mechanical-logo-dark.svg"
          alt="DIC Mechanical"
          className="h-10 w-auto"
          onError={e => { e.target.style.display='none' }}
        />
        <span className="text-white/60 text-xs">Department of Mechanical Engineering · PDEU</span>
      </div>

      {/* Main card */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8 border border-gray-100 dark:border-gray-700">

          {/* Logo + title */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <img
                src="/dic-mechanical-icon-primary-refined.svg"
                alt="DIC Mechanical"
                className="h-16 w-auto"
                onError={e => { e.target.style.display='none' }}
              />
            </div>
            <h1 className="text-2xl font-bold text-[#003087] dark:text-white">
              DIC Mechanical
            </h1>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              ME Department Data Portal
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">Email Address</label>
              <input
                type="email" className="form-input" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@sot.pdpu.ac.in" required autoFocus
              />
            </div>
            <div>
              <label className="form-label">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  className="form-input pr-10"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
                >
                  {showPwd ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
              {loading
                ? <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                    Signing in…
                  </span>
                : 'Sign In'
              }
            </button>
          </form>

          {/* Forgot password */}
          <div className="mt-6 bg-gray-50 dark:bg-gray-700 rounded-xl p-4 border border-gray-100 dark:border-gray-600">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Forgot your password?</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Contact your administrator — Salman, Krunal, Vivek Jaiswal, Anirudh, or Abhinaya —
              to reset it. Then use <span className="font-medium text-gray-600 dark:text-gray-300">🔒 Change Password</span> in the sidebar.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 px-6 space-y-1">
        <p className="text-white/50 text-xs">
          Powered by <span className="text-white/70 font-medium">DIC Mechanical</span>
          &nbsp;·&nbsp;
          © DIC Mechanical, PDEU
        </p>
        <p className="text-white/40 text-xs">
          Coded by <span className="text-white/60">Anirudh Kulkarni, PhD.</span>
        </p>
      </div>
    </div>
  )
}
