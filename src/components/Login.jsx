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

  // Show session-expired notice if redirected from auto-logout
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
    <div className="min-h-screen bg-gradient-to-br from-pdeu-blue to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-pdeu-light rounded-full mb-4">
            <span className="text-3xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-pdeu-blue">ME Dept Data Portal</h1>
          <p className="text-gray-400 text-sm mt-1">Pandit Deendayal Energy University</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label">Email Address</label>
            <input type="email" className="form-input" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@pdpu.ac.in" required autoFocus
            />
          </div>
          <div>
            <label className="form-label">Password</label>
            <input type="password" className="form-input" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
            />
          </div>
          <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {/* Forgot password guidance */}
        <div className="mt-6 bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-500 mb-1">Forgot your password?</p>
          <p className="text-xs text-gray-400">
            Contact your department administrator (Salman, Krunal, Vivek Jaiswal, Anirudh, or Abhinaya)
            to reset it. Once reset, log in and go to <span className="font-medium text-gray-600">🔒 Change Password</span> to set your own.
          </p>
        </div>
      </div>
    </div>
  )
}
