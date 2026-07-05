import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useProfile } from './data/hooks'
import { supabaseConfigured } from './lib/supabase'
import { Spinner } from './components/ui'
import Layout from './components/Layout'
import SetupScreen from './pages/SetupScreen'
import Auth from './pages/Auth'
import ResetPassword from './pages/ResetPassword'
import Onboarding from './pages/Onboarding'
import Today from './pages/Today'
import Workout from './pages/Workout'
import Progress from './pages/Progress'
import Metrics from './pages/Metrics'
import Nutrition from './pages/Nutrition'
import Supplements from './pages/Supplements'
import Sleep from './pages/Sleep'
import Cardio from './pages/Cardio'
import Coach from './pages/Coach'
import Rachas from './pages/Rachas'
import Profile from './pages/Profile'

export default function App() {
  const { user, loading, recovery } = useAuth()

  if (!supabaseConfigured) return <SetupScreen />
  if (loading) return <div className="app-shell"><div className="page"><Spinner label="Cargando…" /></div></div>
  if (recovery) return <ResetPassword />
  if (!user) return <Auth />
  return <AuthedApp />
}

function AuthedApp() {
  const { data: profile, isLoading } = useProfile()

  if (isLoading) return <div className="app-shell"><div className="page"><Spinner label="Cargando tu perfil…" /></div></div>
  if (profile && !profile.onboarded) return <Onboarding />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Today />} />
        <Route path="/workout" element={<Workout />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/metrics" element={<Metrics />} />
        <Route path="/nutrition" element={<Nutrition />} />
        <Route path="/supplements" element={<Supplements />} />
        <Route path="/sleep" element={<Sleep />} />
        <Route path="/cardio" element={<Cardio />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/rachas" element={<Rachas />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
