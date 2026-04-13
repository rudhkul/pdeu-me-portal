import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children, requiredRole }) {
  const { session, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-pdeu-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 dark:text-gray-500 text-sm">Loading…</p>
      </div>
    </div>
  )

  if (!session) return <Navigate to="/login" replace />
  if (requiredRole && session.role !== requiredRole)
    return <Navigate to={session.role === 'admin' ? '/admin' : '/faculty'} replace />

  return children
}
