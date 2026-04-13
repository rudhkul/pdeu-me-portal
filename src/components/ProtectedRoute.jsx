import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children, requiredRole }) {
  const { session, loading, effectiveRole } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-pdeu-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 dark:text-gray-500 text-sm">Loading…</p>
      </div>
    </div>
  )

  if (!session) return <Navigate to="/login" replace />

  // No role requirement → any logged-in user
  if (!requiredRole) return children

  // Use effectiveRole so admin-in-faculty-mode can access faculty routes
  if (requiredRole === 'faculty' && (effectiveRole === 'faculty' || session.role === 'admin'))
    return children

  // Admin routes: only real admins
  if (requiredRole === 'admin' && session.role === 'admin')
    return children

  // Redirect to correct home
  return <Navigate to={effectiveRole === 'admin' ? '/admin' : '/faculty'} replace />
}
