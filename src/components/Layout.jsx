import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { Home, LineChart, Sparkles, Trophy, User, Flame } from 'lucide-react'
import { useProfile, useStreaks } from '../data/hooks'
import { levelFromXp } from '../lib/gamification'
import { Ring } from './ui'

const NAV = [
  { to: '/', label: 'Hoy', icon: Home, end: true },
  { to: '/progress', label: 'Progreso', icon: LineChart },
  { to: '/coach', label: 'Coach', icon: Sparkles },
  { to: '/achievements', label: 'Logros', icon: Trophy },
  { to: '/profile', label: 'Perfil', icon: User },
]

export default function Layout() {
  const navigate = useNavigate()
  const { data: profile } = useProfile()
  const { data: streaks } = useStreaks()
  const lvl = levelFromXp(profile?.xp || 0)
  const workoutStreak = streaks?.find((s) => s.kind === 'workout')?.current_count || 0

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="logo"><Flame size={18} /></span>
          <span>Forge</span>
        </div>
        <div className="row gap-8">
          {workoutStreak > 0 && (
            <span className="pill accent" title="Racha de entreno">
              <Flame size={14} /> {workoutStreak}
            </span>
          )}
          <button className="level-chip" onClick={() => navigate('/achievements')} aria-label={`Nivel ${lvl.level}, ${lvl.rank.name}`}>
            <span className="lvl" style={{ color: lvl.rank.color }}>Nv {lvl.level}</span>
            <Ring progress={lvl.progress} size={30} stroke={4} color={lvl.rank.color} />
          </button>
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
