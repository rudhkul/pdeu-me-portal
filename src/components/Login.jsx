import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

const BASE = import.meta.env.BASE_URL
const ICON = `${BASE}dic-mechanical-icon-primary-refined.svg`

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
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #001f6b 0%, #003087 40%, #1F4AA8 100%)' }}>

      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12">
        {/* Top logo */}
        <div className="flex items-center gap-3">
          {/* White circle bg so dark SVG is visible */}
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            <img src={ICON} alt="DIC" className="h-8 w-auto"
              style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          <div>
            <p className="text-white font-bold text-base leading-tight">DIC Mechanical</p>
            <p className="text-white/50 text-xs">PDEU</p>
          </div>
        </div>

        {/* Centre text */}
        <div>
          {/* Big icon */}
          <div className="mb-8">
            <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
              <img src={ICON} alt="DIC Mechanical" className="h-16 w-auto"
                style={{ filter: 'brightness(0) invert(1)' }} />
            </div>
            <h1 className="text-white text-4xl font-bold leading-tight mb-3">
              ME Department<br />Data Portal
            </h1>
            <p className="text-white/60 text-base leading-relaxed max-w-xs">
              Centralised academic data collection for faculty of the Department of Mechanical Engineering.
            </p>
          </div>

          {/* Features */}
          {['20 data sections', 'PDF proof uploads', 'Excel exports & analytics', 'Secure role-based access'].map(f => (
            <div key={f} className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
              <span className="text-white/50 text-sm">{f}</span>
            </div>
          ))}
        </div>

        {/* Bottom credits */}
        <div>
          <p className="text-white/30 text-xs">
            Powered by DIC Mechanical · © DIC Mechanical, PDEU
          </p>
          <p className="text-white/20 text-xs mt-0.5">
            Coded by Anirudh Kulkarni, PhD.
          </p>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">

        {/* Mobile logo — only on small screens */}
        <div className="lg:hidden flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-3">
            <img src={ICON} alt="DIC Mechanical" className="h-10 w-auto"
              style={{ filter: 'brightness(0) invert(1)' }} />
          </div>
          <p className="text-white font-bold text-xl">DIC Mechanical</p>
          <p className="text-white/50 text-sm">ME Department Data Portal</p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-1">Sign In</h2>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-6">
            Use your institutional email address
          </p>

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

            <button type="submit" className="btn-primary w-full !py-2.5 text-sm" disabled={loading}>
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

        {/* Mobile footer */}
        <p className="lg:hidden mt-6 text-white/30 text-xs text-center">
          Powered by DIC Mechanical · © DIC Mechanical, PDEU<br />
          Coded by Anirudh Kulkarni, PhD.
        </p>
      </div>

    </div>
  )
}
