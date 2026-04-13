import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useDarkMode } from '../hooks/useDarkMode'
import { TABS } from '../config/tabs'
import toast from 'react-hot-toast'

function HamburgerIcon({ open }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      {open ? (<><line x1="4" y1="4" x2="18" y2="18"/><line x1="18" y1="4" x2="4" y2="18"/></>)
             : (<><line x1="3" y1="6" x2="19" y2="6"/><line x1="3" y1="11" x2="19" y2="11"/><line x1="3" y1="16" x2="19" y2="16"/></>)}
    </svg>
  )
}

function NavItem({ to, icon, label, open, end = false }) {
  const cls = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors relative group ${
      isActive ? 'bg-pdeu-blue text-white font-medium'
               : 'text-gray-600 dark:text-gray-300 hover:bg-pdeu-light dark:hover:bg-gray-700 hover:text-pdeu-blue'
    }`
  return (
    <NavLink to={to} end={end} className={cls}>
      <span className="flex-shrink-0 text-base">{icon}</span>
      {open ? <span className="truncate">{label}</span>
            : <span className="absolute left-14 bg-gray-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">{label}</span>
      }
    </NavLink>
  )
}

export default function Layout({ children }) {
  const { session, signOut }   = useAuth()
  const [dark, setDark]        = useDarkMode()
  const navigate               = useNavigate()
  const isAdmin                = session?.role === 'admin'
  const [mobileOpen, setMobileOpen] = useState(false)
  const [open, setOpen]        = useState(() => localStorage.getItem('sidebar_open') !== 'false')

  function toggleSidebar() {
    const next = !open
    setOpen(next)
    localStorage.setItem('sidebar_open', String(next))
  }

  useEffect(() => { setMobileOpen(false) }, [navigate])
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  function handleSignOut() {
    signOut(); navigate('/login'); toast.success('Signed out')
  }

  function SidebarContent() {
    return (
      <>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {isAdmin ? (
            <>
              {open && <p className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase tracking-wider">Admin</p>}
              <NavItem to="/admin"         icon="📊" label="Dashboard"      open={open} end />
              <NavItem to="/admin/export"  icon="📥" label="Export Builder"  open={open} />
              <NavItem to="/admin/users"   icon="👥" label="User Management" open={open} />
              <NavItem to="/admin/deadline" icon="⏰" label="Set Deadline"   open={open} />
              {open && <p className="text-xs font-semibold text-gray-400 px-2 py-1 mt-3 uppercase tracking-wider">All Tabs</p>}
              {TABS.map(tab => <NavItem key={tab.id} to={`/admin/tab/${tab.id}`} icon={tab.icon} label={`${tab.number}. ${tab.name}`} open={open} />)}
            </>
          ) : (
            <>
              {open && <p className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase tracking-wider">My Data</p>}
              <NavItem to="/faculty" icon="🏠" label="Dashboard" open={open} end />
              {TABS.map(tab => <NavItem key={tab.id} to={`/faculty/tab/${tab.id}`} icon={tab.icon} label={`${tab.number}. ${tab.name}`} open={open} />)}
            </>
          )}
        </nav>

        <div className="border-t border-gray-100 dark:border-gray-700 p-3 space-y-1">
          <NavItem to="/change-password" icon="🔒" label="Change Password" open={open} />

          {/* Dark mode toggle */}
          <button onClick={() => setDark(d => !d)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors w-full
              text-gray-600 dark:text-gray-300 hover:bg-pdeu-light dark:hover:bg-gray-700 hover:text-pdeu-blue`}>
            <span className="flex-shrink-0">{dark ? '☀️' : '🌙'}</span>
            {open && <span>{dark ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>

          <div className="flex items-center gap-2 px-1 pt-1">
            <div className="w-8 h-8 rounded-full bg-pdeu-blue text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
              {session?.fullName?.[0]?.toUpperCase() || '?'}
            </div>
            {open && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{session?.fullName}</p>
                <p className="text-xs text-gray-400 capitalize">{session?.role}</p>
              </div>
            )}
            <button onClick={handleSignOut} title="Sign out"
              className="ml-auto flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
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
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Mobile drawer */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 flex flex-col z-30 transition-transform duration-250 lg:hidden ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-700 min-h-[64px]">
          <span className="text-2xl">🎓</span>
          <div className="min-w-0"><p className="font-bold text-pdeu-blue text-sm">ME Dept Portal</p><p className="text-xs text-gray-400">PDEU</p></div>
          <button onClick={() => setMobileOpen(false)} className="ml-auto w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"><HamburgerIcon open /></button>
        </div>
        <SidebarContent />
      </aside>

      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 transition-all duration-200 overflow-hidden ${open ? 'w-64' : 'w-16'}`}>
        <div className="flex items-center gap-3 px-3 py-4 border-b border-gray-100 dark:border-gray-700 min-h-[64px]">
          <span className="text-2xl flex-shrink-0">🎓</span>
          {open && <div className="min-w-0 flex-1"><p className="font-bold text-pdeu-blue text-sm truncate">ME Dept Portal</p><p className="text-xs text-gray-400">PDEU</p></div>}
          <button onClick={toggleSidebar} title={open ? 'Collapse' : 'Expand'}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-pdeu-blue hover:bg-pdeu-light dark:hover:bg-gray-700 transition-colors ml-auto">
            <HamburgerIcon open={open} />
          </button>
        </div>
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <button onClick={() => setMobileOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <HamburgerIcon open={false} />
          </button>
          <span className="text-2xl">🎓</span>
          <p className="font-bold text-pdeu-blue text-sm">ME Dept Portal</p>
          <button onClick={() => setDark(d => !d)} className="ml-auto text-xl">{dark ? '☀️' : '🌙'}</button>
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
