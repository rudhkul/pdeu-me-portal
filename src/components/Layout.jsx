import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { TABS } from '../config/tabs'
import toast from 'react-hot-toast'

export default function Layout({ children }) {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const isAdmin  = session?.role === 'admin'
  const [open, setOpen] = useState(true)

  function handleSignOut() {
    signOut()
    navigate('/login')
    toast.success('Signed out')
  }

  const navCls = ({ isActive }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
      isActive
        ? 'bg-pdeu-blue text-white font-medium'
        : 'text-gray-600 hover:bg-pdeu-light hover:text-pdeu-blue'
    }`

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`${open ? 'w-64' : 'w-16'} flex-shrink-0 bg-white border-r border-gray-100 flex flex-col transition-all duration-200 overflow-hidden`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 min-h-[64px]">
          <span className="text-2xl flex-shrink-0">🎓</span>
          {open && (
            <div className="min-w-0">
              <p className="font-bold text-pdeu-blue text-sm leading-tight truncate">ME Dept Portal</p>
              <p className="text-xs text-gray-400">PDEU</p>
            </div>
          )}
          <button onClick={() => setOpen(o => !o)} className="ml-auto text-gray-300 hover:text-gray-600 text-xs flex-shrink-0">
            {open ? '◀' : '▶'}
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {isAdmin ? (
            <>
              {open && <p className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase tracking-wider">Admin</p>}
              <NavLink to="/admin" end className={navCls}><span>📊</span>{open && 'Dashboard'}</NavLink>
              <NavLink to="/admin/export" className={navCls}><span>📥</span>{open && 'Export Builder'}</NavLink>
              {open && <p className="text-xs font-semibold text-gray-400 px-2 py-1 mt-3 uppercase tracking-wider">All Tabs</p>}
              {TABS.map(tab => (
                <NavLink key={tab.id} to={`/admin/tab/${tab.id}`} className={navCls}>
                  <span className="flex-shrink-0">{tab.icon}</span>
                  {open && <span className="truncate">{tab.number}. {tab.name}</span>}
                </NavLink>
              ))}
            </>
          ) : (
            <>
              {open && <p className="text-xs font-semibold text-gray-400 px-2 py-1 uppercase tracking-wider">My Data</p>}
              <NavLink to="/faculty" end className={navCls}><span>🏠</span>{open && 'Dashboard'}</NavLink>
              {TABS.map(tab => (
                <NavLink key={tab.id} to={`/faculty/tab/${tab.id}`} className={navCls}>
                  <span className="flex-shrink-0">{tab.icon}</span>
                  {open && <span className="truncate">{tab.number}. {tab.name}</span>}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* User footer */}
        <div className="border-t border-gray-100 p-3 flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-pdeu-blue text-white text-xs flex items-center justify-center font-bold flex-shrink-0">
            {session?.fullName?.[0]?.toUpperCase() || '?'}
          </div>
          {open && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 truncate">{session?.fullName}</p>
              <p className="text-xs text-gray-400 capitalize">{session?.role}</p>
            </div>
          )}
          <button onClick={handleSignOut} title="Sign out" className="text-gray-300 hover:text-red-400 ml-auto flex-shrink-0 text-sm">
            ⏻
          </button>
        </div>
      </aside>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
