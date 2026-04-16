import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './components/Login'
import ChangePassword from './components/ChangePassword'
import FacultyDashboard from './components/faculty/FacultyDashboard'
import FacultyProfile from './components/faculty/FacultyProfile'
import TabForm from './components/faculty/TabForm'
import AdminDashboard from './components/admin/AdminDashboard'
import DataViewer from './components/admin/DataViewer'
import ExportBuilder from './components/admin/ExportBuilder'
import AdminUsers from './components/admin/AdminUsers'
import AdminPasswordReset from './components/admin/AdminPasswordReset'
import DeadlineManager from './components/admin/DeadlineManager'
import NotificationSettings from './components/admin/NotificationSettings'
import Announcements from './components/admin/Announcements'
import NotSubmittedList from './components/admin/NotSubmittedList'

function RootRedirect() {
  const { session, loading, effectiveRole } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={effectiveRole === 'admin' ? '/admin' : '/faculty'} replace />
}

const Faculty = el => <ProtectedRoute requiredRole="faculty"><Layout>{el}</Layout></ProtectedRoute>
const Admin   = el => <ProtectedRoute requiredRole="admin"><Layout>{el}</Layout></ProtectedRoute>
const Any     = el => <ProtectedRoute><Layout>{el}</Layout></ProtectedRoute>

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Toaster position="top-right" toastOptions={{
          duration: 4000,
          style: { fontSize: '14px', borderRadius: '10px' },
        }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/"     element={<RootRedirect />} />

          <Route path="/change-password"  element={Any(<ChangePassword />)} />

          <Route path="/faculty"              element={Faculty(<FacultyDashboard />)} />
          <Route path="/faculty/tab/:tabId"   element={Faculty(<TabForm />)} />
          <Route path="/faculty/profile"      element={Faculty(<FacultyProfile />)} />

          <Route path="/admin"                    element={Admin(<AdminDashboard />)} />
          <Route path="/admin/tab/:tabId"         element={Admin(<DataViewer />)} />
          <Route path="/admin/export"             element={Admin(<ExportBuilder />)} />
          <Route path="/admin/users"              element={Admin(<AdminUsers />)} />
          <Route path="/admin/passwords"          element={Admin(<AdminPasswordReset />)} />
          <Route path="/admin/deadline"           element={Admin(<DeadlineManager />)} />
          <Route path="/admin/notifications"      element={Admin(<NotificationSettings />)} />
          <Route path="/admin/announcements"      element={Admin(<Announcements />)} />
          <Route path="/admin/not-submitted"      element={Admin(<NotSubmittedList />)} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  )
}
