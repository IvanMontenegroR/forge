import { useMemo, useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Trophy, Dumbbell } from 'lucide-react'
import { useProfile, useProgramDays, useExerciseHistory, useSessions } from '../data/hooks'
import { weekStart } from '../lib/dates'
import { Card, Spinner, Empty, Stat } from '../components/ui'

export default function Progress() {
  const { data: profile } = useProfile()
  const { data: programDays } = useProgramDays(profile?.active_program_id)
  const { data: sessions } = useSessions()

  // ejercicios únicos del programa
  const exercises = useMemo(() => {
    const map = new Map()
    for (const d of programDays || []) {
      for (const pde of d.program_day_exercises || []) {
        if (pde.exercise && !map.has(pde.exercise_id)) map.set(pde.exercise_id, pde.exercise)
      }
    }
    return [...map.values()]
  }, [programDays])

  const [selected, setSelected] = useState(null)
  const exId = selected || exercises[0]?.id

  // volumen por semana (últimas 8)
  const weekly = useMemo(() => {
    const byWeek = new Map()
    for (const s of sessions || []) {
      if (s.status !== 'completed') continue
      const w = weekStart(s.date)
      byWeek.set(w, (byWeek.get(w) || 0) + Number(s.total_volume_kg || 0))
    }
    return [...byWeek.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-8)
      .map(([w, v]) => ({ week: w.slice(5), Volumen: Math.round(v) }))
  }, [sessions])

  const completedCount = (sessions || []).filter((s) => s.status === 'completed').length

  if (!profile) return <div className="page"><Spinner /></div>

  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">Progreso</p><h1>Tu fuerza en el tiempo</h1></div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 14 }}>
        <Card style={{ padding: 14 }}><Stat label="Sesiones completadas" value={completedCount} /></Card>
        <Card style={{ padding: 14 }}><Stat label="Volumen esta semana" value={weekly.at(-1)?.Volumen ?? 0} suffix="kg" /></Card>
      </div>

      <Card title="Volumen semanal">
        {weekly.length > 0 ? (
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <XAxis dataKey="week" stroke="var(--text-faint)" fontSize={11} />
                <YAxis stroke="var(--text-faint)" fontSize={11} />
                <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }} cursor={{ fill: 'var(--surface-2)' }} />
                <Bar dataKey="Volumen" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty icon="🏋️" title="Sin sesiones todavía">Completá tu primer entrenamiento.</Empty>}
      </Card>

      <Card title="Por ejercicio">
        <div className="row wrap gap-8" style={{ marginBottom: 12 }}>
          {exercises.map((ex) => (
            <button key={ex.id} className="chip" aria-pressed={exId === ex.id} onClick={() => setSelected(ex.id)}>{ex.name}</button>
          ))}
        </div>
        {exId && <ExerciseChart exerciseId={exId} />}
      </Card>
    </div>
  )
}

function ExerciseChart({ exerciseId }) {
  const { data: history, isLoading } = useExerciseHistory(exerciseId)

  const { data, pr, estPr } = useMemo(() => {
    const bySession = new Map()
    for (const s of history || []) {
      const date = s.session?.date
      if (!date) continue
      const w = Number(s.weight_kg)
      const e1rm = w * (1 + Number(s.reps) / 30) // Epley
      const cur = bySession.get(date) || { date, top: 0, e1rm: 0 }
      cur.top = Math.max(cur.top, w)
      cur.e1rm = Math.max(cur.e1rm, e1rm)
      bySession.set(date, cur)
    }
    const arr = [...bySession.values()].sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((d) => ({ date: d.date.slice(5), Peso: d.top, e1RM: Math.round(d.e1rm) }))
    const pr = arr.reduce((m, d) => Math.max(m, d.Peso), 0)
    const estPr = arr.reduce((m, d) => Math.max(m, d.e1RM), 0)
    return { data: arr, pr, estPr }
  }, [history])

  if (isLoading) return <Spinner />
  if (!data.length) return <Empty icon="📊" title="Sin registros">Registrá este ejercicio en una sesión.</Empty>

  return (
    <>
      <div className="row gap-12" style={{ marginBottom: 12 }}>
        <span className="pill accent"><Trophy size={14} /> PR {pr} kg</span>
        <span className="pill"><Dumbbell size={14} /> e1RM ~{estPr} kg</span>
      </div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <XAxis dataKey="date" stroke="var(--text-faint)" fontSize={11} />
            <YAxis stroke="var(--text-faint)" fontSize={11} />
            <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }} />
            <Line type="monotone" dataKey="Peso" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="e1RM" stroke="var(--xp)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
