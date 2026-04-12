import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './components/Login'
import FacultyDashboard from './components/faculty/FacultyDashboard'
import TabForm from './components/faculty/TabForm'
import AdminDashboard from './components/admin/AdminDashboard'
import DataViewer from './components/admin/DataViewer'
import ExportBuilder from './components/admin/ExportBuilder'

function RootRedirect() {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={session.role === 'admin' ? '/admin' : '/faculty'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/pdeu-me-portal">
        <Toaster position="top-right" toastOptions={{ duration: 3500, style: { fontSize: '14px', borderRadius: '10px' } }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<RootRedirect />} />

          <Route path="/faculty" element={<ProtectedRoute requiredRole="faculty"><Layout><FacultyDashboard /></Layout></ProtectedRoute>} />
          <Route path="/faculty/tab/:tabId" element={<ProtectedRoute requiredRole="faculty"><Layout><TabForm /></Layout></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><Layout><AdminDashboard /></Layout></ProtectedRoute>} />
          <Route path="/admin/tab/:tabId" element={<ProtectedRoute requiredRole="admin"><Layout><DataViewer /></Layout></ProtectedRoute>} />
          <Route path="/admin/export" element={<ProtectedRoute requiredRole="admin"><Layout><ExportBuilder /></Layout></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
