import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

// Use BASE_URL so paths work on GitHub Pages (/pdeu-me-portal/) and localhost (/)
const BASE   = import.meta.env.BASE_URL
const ICON   = `${BASE}dic-mechanical-icon-primary-refined.svg`
const LOGO   = `${BASE}dic-mechanical-logo-dark.svg`

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
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(135deg, #003087 0%, #1a3fa8 50%, #1F4AA8 100%)' }}>

      {/* Top strip */}
      <div className="flex items-center justify-between px-8 pt-6 pb-2">
        <img src={LOGO} alt="DIC Mechanical" className="h-9 w-auto" />
        <span className="text-white/50 text-xs hidden sm:block">
          Department of Mechanical Engineering · PDEU
        </span>
      </div>

      {/* Centre card */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">

          {/* Icon + name above card */}
          <div className="flex flex-col items-center mb-6">
            <img src={ICON} alt="DIC Mechanical" className="h-20 w-auto mb-3 drop-shadow-lg" />
            <h1 className="text-white text-2xl font-bold tracking-tight">DIC Mechanical</h1>
            <p className="text-white/60 text-sm mt-0.5">ME Department Data Portal</p>
          </div>

          {/* Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-7">
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
                    className="form-input pr-14"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required
                  />
                  <button type="button" onClick={() => setShowPwd(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 font-medium">
                    {showPwd ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary w-full !py-2.5 text-base" disabled={loading}>
                {loading
                  ? <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                      Signing in…
                    </span>
                  : 'Sign In'
                }
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Forgot your password?</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                Contact Salman, Krunal, Vivek Jaiswal, Anirudh, or Abhinaya to reset it.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-5 space-y-0.5">
        <p className="text-white/40 text-xs">
          Powered by <span className="text-white/60 font-medium">DIC Mechanical</span>
          &ensp;·&ensp;
          © DIC Mechanical, PDEU
        </p>
        <p className="text-white/30 text-xs">
          Coded by <span className="text-white/50">Anirudh Kulkarni, PhD.</span>
        </p>
      </div>
    </div>
  )
}
