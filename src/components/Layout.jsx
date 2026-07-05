import { NavLink, Outlet } from 'react-router-dom'
import { Home, LineChart, Sparkles, Flame, User } from 'lucide-react'

const NAV = [
  { to: '/', label: 'Hoy', icon: Home, end: true },
  { to: '/progress', label: 'Progreso', icon: LineChart },
  { to: '/coach', label: 'Coach', icon: Sparkles },
  { to: '/rachas', label: 'Rachas', icon: Flame },
  { to: '/profile', label: 'Perfil', icon: User },
]

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo"><Flame size={18} /></span>
          <span>Forge</span>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="Navegación principal">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
