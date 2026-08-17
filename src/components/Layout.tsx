import {
  Bell,
  Boxes,
  Handshake,
  LayoutDashboard,
  LogOut,
  Menu,
  Route,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth'

const navigation = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/inventory', label: 'Inventory', icon: Boxes },
  { to: '/trips', label: 'Trips', icon: Route },
  { to: '/agreements', label: 'Agreements', icon: Handshake },
  { to: '/teams', label: 'Teams', icon: Users },
]

export function Layout() {
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="layout">
      <header className="mobile-header">
        <div className="brand brand--mobile">Marketeers</div>
        <button className="icon-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <aside className={`sidebar ${menuOpen ? 'sidebar--open' : ''}`}>
        <div>
          <div className="brand">Marketeers <span>Club</span></div>
          <nav aria-label="Main navigation">
            {navigation.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} end={to === '/'} onClick={() => setMenuOpen(false)}>
                <Icon size={19} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="account">
          <div className="avatar">{user?.email?.slice(0, 1).toUpperCase()}</div>
          <div className="account__details">
            <strong>{user?.user_metadata.display_name || 'Member'}</strong>
            <span>{user?.email}</span>
          </div>
          <button className="icon-button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {menuOpen && <button className="scrim" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}

      <main className="main-content">
        <div className="topbar">
          <span>Shared selling workspace</span>
          <NavLink className="icon-button" to="/notifications" aria-label="Notifications" title="Notifications">
            <Bell size={19} />
          </NavLink>
        </div>
        <Outlet />
      </main>
    </div>
  )
}