import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useDarkMode } from '../hooks/useDarkMode'
import { TABS } from '../config/tabs'
import { getFacultyRecords } from '../lib/github'
import { getStoredFileObjectUrl } from '../lib/filestore'
import toast from 'react-hot-toast'

const ICON = `${import.meta.env.BASE_URL}dic-mechanical-icon-primary-refined.svg`

function HamburgerIcon({ open }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {open
        ? (<><line x1="4" y1="4" x2="18" y2="18"/><line x1="18" y1="4" x2="4" y2="18"/></>)
        : (<><line x1="3" y1="6" x2="19" y2="6"/><line x1="3" y1="11" x2="19" y2="11"/><line x1="3" y1="16" x2="19" y2="16"/></>)
      }
    </svg>
  )
}

function NavItem({ to, icon, label, open, end = false }) {
  const cls = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors relative group ${
      isActive
        ? 'bg-pdeu-blue text-white font-medium'
        : 'text-gray-600 dark:text-gray-300 hover:bg-pdeu-light dark:hover:bg-gray-700 hover:text-pdeu-blue'
    }`
  return (
    <NavLink to={to} end={end} className={cls}>
      <span className="flex-shrink-0 text-base">{icon}</span>
      {open
        ? <span className="truncate">{label}</span>
        : <span className="
            absolute left-14 bg-gray-800 dark:bg-gray-600 text-white text-xs rounded-lg
            px-3 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100
            pointer-events-none transition-opacity z-50 shadow-lg
          ">{label}</span>
      }
    </NavLink>
  )
}

function ModeSwitcher({ viewMode, onSwitchView, open }) {
  const isAdmin = viewMode === 'admin'
  const isFaculty = viewMode === 'faculty'

  if (!open) {
    return (
      <div className="px-2 mb-2">
        <button
          title={isAdmin ? 'Switch to My Faculty Data' : 'Switch to Admin View'}
          onClick={() => onSwitchView(isAdmin ? 'faculty' : 'admin')}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg
                     bg-pdeu-light dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-gray-600
                     transition-colors mx-auto"
        >
          {isAdmin ? '👤' : '🛡️'}
        </button>
      </div>
    )
  }

  return (
    <div className="px-2 mb-3">
      <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1 mb-2">
        Current Mode
      </p>
      <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 p-1 gap-1">
        <button
          onClick={() => onSwitchView('admin')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all ${
            isAdmin
              ? 'bg-pdeu-blue text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          🛡️ Admin
        </button>
        <button
          onClick={() => onSwitchView('faculty')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-all ${
            isFaculty
              ? 'bg-white dark:bg-gray-800 text-pdeu-blue shadow-sm font-semibold'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
          }`}
        >
          👤 My Data
        </button>
      </div>
      {isFaculty && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 px-1 flex items-center gap-1">
          <span>⚠️</span> You are filling your own faculty data
        </p>
      )}
    </div>
  )
}

export default function Layout({ children }) {
  const { session, signOut, viewMode, switchView } = useAuth()
  const [dark, setDark] = useDarkMode()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = session?.role === 'admin'
  const showingFacultyView = isAdmin && viewMode === 'faculty'
  const [mobileOpen, setMobileOpen] = useState(false)
  const [open, setOpen] = useState(() => localStorage.getItem('sidebar_open') !== 'false')
  const [profilePicturePath, setProfilePicturePath] = useState('')
  const [profilePictureUrl, setProfilePictureUrl] = useState('')

  function toggleSidebar() {
    const next = !open
    setOpen(next)
    localStorage.setItem('sidebar_open', String(next))
  }

  function handleSwitchView(mode) {
    if (!isAdmin) return
    switchView(mode)

    if (mode === 'faculty') {
      const adminTabMatch = location.pathname.match(/^\/faculty\/tab\/(.+)$/) || location.pathname.match(/^\/admin\/tab\/(.+)$/)
      if (adminTabMatch?.[1]) {
        navigate(`/faculty/tab/${adminTabMatch[1]}`)
        return
      }
      navigate('/faculty')
      return
    }

    const facultyTabMatch = location.pathname.match(/^\/faculty\/tab\/(.+)$/) || location.pathname.match(/^\/admin\/tab\/(.+)$/)
    if (facultyTabMatch?.[1]) {
      navigate(`/admin/tab/${facultyTabMatch[1]}`)
      return
    }
    navigate('/admin')
  }

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])


  useEffect(() => {
    if (!session?.userId) {
      setProfilePicturePath('')
      return
    }

    let active = true

    async function loadProfilePicturePath() {
      try {
        const records = await getFacultyRecords('tab1', session.userId)
        const path = records?.[0]?.profile_picture || ''
        if (active) setProfilePicturePath(path)
      } catch {
        if (active) setProfilePicturePath('')
      }
    }

    loadProfilePicturePath()

    const reload = () => loadProfilePicturePath()
    window.addEventListener('pdeu-profile-updated', reload)
    return () => {
      active = false
      window.removeEventListener('pdeu-profile-updated', reload)
    }
  }, [session?.userId])

  useEffect(() => {
    if (!profilePicturePath) {
      setProfilePictureUrl('')
      return
    }

    let active = true
    let objectUrl = ''

    async function loadProfilePicture() {
      try {
        const result = await getStoredFileObjectUrl(profilePicturePath)
        objectUrl = result.objectUrl
        if (!active) {
          URL.revokeObjectURL(objectUrl)
          return
        }
        setProfilePictureUrl(objectUrl)
      } catch {
        if (active) setProfilePictureUrl('')
      }
    }

    loadProfilePicture()
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [profilePicturePath])

  function handleSignOut() {
    signOut()
    navigate('/login')
    toast.success('Signed out')
  }

  function SidebarContent() {
    return (
      <>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {isAdmin && (
            <ModeSwitcher viewMode={viewMode} onSwitchView={handleSwitchView} open={open} />
          )}

          {isAdmin && viewMode === 'admin' && (
            <>
              {open && <p className="section-heading">Admin</p>}
              <NavItem to="/admin" icon="📊" label="Dashboard" open={open} end />
              <NavItem to="/admin/export" icon="📥" label="Export Builder" open={open} />
              <NavItem to="/admin/users" icon="👥" label="User Management" open={open} />
              <NavItem to="/admin/deadline" icon="⏰" label="Set Deadline" open={open} />
              <NavItem to="/admin/notifications" icon="📧" label="Email Notifications" open={open} />
              <NavItem to="/admin/announcements" icon="📢" label="Announcements" open={open} />
              <NavItem to="/admin/not-submitted" icon="📋" label="Submission Status" open={open} />
              <NavItem to="/admin/passwords" icon="🔑" label="Reset Passwords" open={open} />
              {open && <p className="section-heading mt-3">All Tabs</p>}
              {TABS.map(tab => (
                <NavItem key={tab.id} to={`/admin/tab/${tab.id}`}
                  icon={tab.icon} label={`${tab.number}. ${tab.name}`} open={open} />
              ))}
            </>
          )}

          {(!isAdmin || viewMode === 'faculty') && (
            <>
              {open && (
                <p className="section-heading">
                  {showingFacultyView ? 'My Faculty Data' : 'My Data'}
                </p>
              )}
              <NavItem to="/faculty" icon="🏠" label="Dashboard" open={open} end />
              <NavItem to="/faculty/profile" icon="🖨️" label="Print Summary" open={open} />
              {TABS.map(tab => (
                <NavItem key={tab.id} to={`/faculty/tab/${tab.id}`}
                  icon={tab.icon} label={`${tab.number}. ${tab.name}`} open={open} />
              ))}
            </>
          )}
        </nav>

        <div className="border-t border-gray-100 dark:border-gray-700 p-3 space-y-1">
          <NavItem to="/change-password" icon="🔒" label="Change Password" open={open} />

          <button
            onClick={() => setDark(d => !d)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full
                       text-gray-600 dark:text-gray-300
                       hover:bg-pdeu-light dark:hover:bg-gray-700 hover:text-pdeu-blue transition-colors"
          >
            <span className="flex-shrink-0">{dark ? '☀️' : '🌙'}</span>
            {open && <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          <div className="flex items-center gap-2 px-1 pt-1">
            <div className="w-8 h-8 rounded-full bg-pdeu-blue text-white text-xs flex items-center justify-center font-bold flex-shrink-0 relative overflow-hidden">
              {profilePictureUrl ? (
                <img src={profilePictureUrl} alt={session?.fullName || 'Profile'} className="w-full h-full object-cover" />
              ) : (
                session?.fullName?.[0]?.toUpperCase() || '?'
              )}
              {showingFacultyView && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full border border-white dark:border-gray-800 text-[8px] flex items-center justify-center">
                  F
                </span>
              )}
            </div>
            {open && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                  {session?.fullName}
                </p>
                <p className="text-xs text-gray-400 capitalize">
                  {showingFacultyView ? 'Admin · Faculty mode' : session?.role}
                </p>
              </div>
            )}
            <button
              onClick={handleSignOut}
              title="Sign out"
              className="ml-auto flex-shrink-0 w-8 h-8 flex items-center justify-center
                         rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50
                         dark:hover:bg-red-900/20 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800
        border-r border-gray-100 dark:border-gray-700
        flex flex-col z-30 transition-transform duration-250 lg:hidden
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700 min-h-[64px]">
          <img src={ICON} alt="DIC Mechanical" className="h-10 w-auto flex-shrink-0 dark:brightness-0 dark:invert" />
          <div className="min-w-0">
            <p className="font-bold text-[#003087] dark:text-white text-sm leading-tight">DIC Mechanical</p>
            <p className="text-xs text-gray-400 leading-tight">ME Dept Portal</p>
          </div>
          <button onClick={() => setMobileOpen(false)}
            className="ml-auto w-9 h-9 flex items-center justify-center rounded-lg
                       text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <HamburgerIcon open />
          </button>
        </div>
        <SidebarContent />
      </aside>

      <aside className={`
        hidden lg:flex flex-col flex-shrink-0 bg-white dark:bg-gray-800
        border-r border-gray-100 dark:border-gray-700
        transition-all duration-200 overflow-hidden
        ${open ? 'w-64' : 'w-16'}
      `}>
        <div className="flex items-center gap-3 px-3 py-4 border-b border-gray-100 dark:border-gray-700 min-h-[64px]">
          <img src={ICON} alt="DIC Mechanical" className="h-10 w-auto flex-shrink-0 dark:brightness-0 dark:invert" />
          {open && (
            <div className="min-w-0 flex-1">
              <p className="font-bold text-[#003087] dark:text-white text-sm truncate leading-tight">DIC Mechanical</p>
              <p className="text-xs text-gray-400 leading-tight">ME Dept Portal</p>
            </div>
          )}
          <button
            onClick={toggleSidebar}
            title={open ? 'Collapse sidebar' : 'Expand sidebar'}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg
                       text-gray-400 hover:text-pdeu-blue hover:bg-pdeu-light
                       dark:hover:bg-gray-700 transition-colors ml-auto"
          >
            <HamburgerIcon open={open} />
          </button>
        </div>
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <button onClick={() => setMobileOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-lg
                       text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <HamburgerIcon open={false} />
          </button>
          <img src={ICON} alt="DIC Mechanical" className="h-8 w-auto dark:brightness-0 dark:invert" />
          <p className="font-bold text-[#003087] dark:text-white text-sm">DIC Mechanical</p>
          {isAdmin && (
            <button
              onClick={() => handleSwitchView(viewMode === 'admin' ? 'faculty' : 'admin')}
              className="ml-2 text-xs px-2 py-1 rounded-lg bg-pdeu-light dark:bg-gray-700 text-pdeu-blue font-medium"
            >
              {viewMode === 'admin' ? '👤 My Data' : '🛡️ Admin'}
            </button>
          )}
          <button onClick={() => setDark(d => !d)} className="ml-auto text-xl">
            {dark ? '☀️' : '🌙'}
          </button>
        </div>

        <main className="flex-1 overflow-y-auto">{children}</main>

        {/* Footer */}
        <footer className="border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400 dark:text-gray-500">
          <div className="flex items-center gap-2">
            <img src={ICON} alt="DIC Mechanical" className="h-5 w-auto opacity-60 dark:brightness-0 dark:invert dark:opacity-40" />
            <span>
              Powered by <span className="font-medium text-gray-500 dark:text-gray-400">DIC Mechanical</span>
              &nbsp;·&nbsp;
              © DIC Mechanical, PDEU
            </span>
          </div>
          <span>
            Coded by <span className="font-medium text-gray-500 dark:text-gray-400">Anirudh Kulkarni, PhD.</span>
          </span>
        </footer>
      </div>
    </div>
  )
}
