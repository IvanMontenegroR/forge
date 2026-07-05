import { useMemo, useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Trophy, Dumbbell, Beef, Flame, Check, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  useProfile, useProgramDays, useExerciseHistory, useSessions,
  useNutritionRange,
} from '../data/hooks'
import {
  weekStart, addDays, todayStr, monthStart, monthEnd, monthLabel,
  WEEKDAY_NAMES, prettyDate,
} from '../lib/dates'
import { Card, Spinner, Empty, Stat, ProgressBar } from '../components/ui'

export default function Progress() {
  const { data: profile } = useProfile()
  const [tab, setTab] = useState('nutricion') // nutricion | entreno

  if (!profile) return <div className="page"><Spinner /></div>

  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">Progreso</p><h1>Tu progreso</h1></div>

      <div className="row" style={{ background: 'var(--bg-elev)', borderRadius: 12, padding: 4, marginBottom: 16 }}>
        <button className={`btn btn-sm grow ${tab === 'nutricion' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('nutricion')} style={{ border: 'none' }}><Beef size={15} /> Nutrición</button>
        <button className={`btn btn-sm grow ${tab === 'entreno' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab('entreno')} style={{ border: 'none' }}><Dumbbell size={15} /> Entrenamiento</button>
      </div>

      {tab === 'nutricion' ? <NutritionProgress profile={profile} /> : <TrainingProgress profile={profile} />}
    </div>
  )
}

// ───────────────────────── Nutrición ─────────────────────────

function aggregateByDate(rows) {
  const m = new Map()
  for (const n of rows || []) {
    const qty = Number(n.qty || 1)
    const cur = m.get(n.date) || { kcal: 0, protein_g: 0 }
    cur.kcal += Number(n.kcal || 0) * qty
    cur.protein_g += Number(n.protein_g || 0) * qty
    m.set(n.date, cur)
  }
  return m
}

function NutritionProgress({ profile }) {
  const proteinGoal = profile.protein_goal_g || 145
  const kcalGoal = profile.target_kcal || 2050
  const today = todayStr()

  const [weekOff, setWeekOff] = useState(0)
  const [openDate, setOpenDate] = useState(null)
  const from = addDays(weekStart(), weekOff * 7)
  const to = addDays(from, 6)
  const { data: weekRows, isLoading } = useNutritionRange(from, to)
  const byDay = useMemo(() => aggregateByDate(weekRows), [weekRows])

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = addDays(from, i)
    const agg = byDay.get(date) || { kcal: 0, protein_g: 0 }
    return {
      date, wd: i + 1, hasData: byDay.has(date), isFuture: date > today,
      kcal: agg.kcal, protein_g: agg.protein_g,
      proteinReached: agg.protein_g >= proteinGoal,
      kcalOver: agg.kcal > kcalGoal,
    }
  }), [from, byDay, proteinGoal, kcalGoal, today])

  const logged = days.filter((d) => d.hasData)
  const proteinDaysOk = logged.filter((d) => d.proteinReached).length
  const kcalDaysOver = logged.filter((d) => d.kcalOver).length
  const weekKcal = days.reduce((s, d) => s + d.kcal, 0)
  const weekProtein = days.reduce((s, d) => s + d.protein_g, 0)

  const rangeLabel = `${prettyDate(from).split(',')[0].replace(/^\w/, (c) => c.toUpperCase())} ${from.slice(8)} – ${to.slice(8)}/${to.slice(5, 7)}`

  return (
    <>
      {/* Navegación de semana */}
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setWeekOff((o) => o - 1)} aria-label="semana anterior"><ChevronLeft size={18} /></button>
        <div className="center" style={{ flex: 1 }}>
          <strong style={{ fontSize: '0.92rem' }}>{weekOff === 0 ? 'Esta semana' : weekOff === -1 ? 'Semana pasada' : rangeLabel}</strong>
          <div className="faint" style={{ fontSize: '0.76rem' }}>{from.slice(8)}/{from.slice(5, 7)} – {to.slice(8)}/{to.slice(5, 7)}</div>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setWeekOff((o) => Math.min(0, o + 1))} disabled={weekOff >= 0} aria-label="semana siguiente"><ChevronRight size={18} /></button>
      </div>

      {/* Resumen semanal */}
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 14 }}>
        <Card style={{ padding: 14 }}>
          <Stat label="Días con proteína OK" value={`${proteinDaysOk}/${logged.length || 0}`} color="var(--success)" />
        </Card>
        <Card style={{ padding: 14 }}>
          <Stat label="Días excedido en kcal" value={`${kcalDaysOver}/${logged.length || 0}`} color={kcalDaysOver ? 'var(--warn)' : 'var(--text)'} />
        </Card>
      </div>

      <Card title="Semana (lun–dom)">
        {isLoading ? <Spinner /> : (
          <div className="col" style={{ gap: 14 }}>
            {days.map((d) => {
              const open = openDate === d.date
              const items = open ? (weekRows || []).filter((r) => r.date === d.date) : []
              return (
                <div key={d.date}>
                  <button
                    className="row gap-12"
                    onClick={() => setOpenDate(open ? null : d.date)}
                    disabled={!d.hasData}
                    style={{ width: '100%', background: 'transparent', border: 'none', padding: 0, textAlign: 'left', cursor: d.hasData ? 'pointer' : 'default', opacity: d.isFuture ? 0.45 : 1 }}
                  >
                    <div className="center" style={{ width: 38 }}>
                      <strong style={{ fontSize: '0.9rem' }}>{WEEKDAY_NAMES[d.wd]}</strong>
                      <div className="faint num" style={{ fontSize: '0.74rem' }}>{d.date.slice(8)}</div>
                    </div>
                    <div className="grow col" style={{ gap: 6 }}>
                      <div className="row between" style={{ fontSize: '0.78rem' }}>
                        <span className="row gap-4"><Beef size={12} color="var(--danger)" /> {Math.round(d.protein_g)}/{proteinGoal}g {d.proteinReached && <Check size={13} color="var(--success)" />}</span>
                        <span className="row gap-4"><Flame size={12} color="var(--info)" /> {Math.round(d.kcal)}/{kcalGoal} {d.kcalOver && <AlertTriangle size={12} color="var(--warn)" />}</span>
                      </div>
                      <ProgressBar value={d.protein_g} max={proteinGoal} variant={d.proteinReached ? 'success' : ''} />
                      <ProgressBar value={d.kcal} max={kcalGoal} variant={d.kcalOver ? 'warn' : 'info'} />
                    </div>
                    <ChevronRight size={16} color="var(--text-faint)" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', opacity: d.hasData ? 1 : 0 }} />
                  </button>
                  {open && (
                    <div className="col" style={{ paddingLeft: 50, marginTop: 6 }}>
                      {items.length ? items.map((l) => (
                        <div key={l.id} className="list-row" style={{ padding: '8px 0' }}>
                          <div className="grow">
                            <strong style={{ fontSize: '0.9rem' }}>{l.name}{l.qty > 1 ? ` ×${l.qty}` : ''}</strong>
                            <span className="faint num" style={{ display: 'block', fontSize: '0.78rem' }}>
                              {Math.round(l.protein_g * l.qty)} g proteína{l.kcal ? ` · ${Math.round(l.kcal * l.qty)} kcal` : ''}
                            </span>
                          </div>
                        </div>
                      )) : <p className="faint" style={{ fontSize: '0.8rem', padding: '6px 0' }}>Nada registrado ese día.</p>}
                    </div>
                  )}
                </div>
              )
            })}
            <div className="col gap-6" style={{ marginTop: 4, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div className="faint num center" style={{ fontSize: '0.8rem' }}>
                Total semana: {Math.round(weekProtein)} g proteína · {Math.round(weekKcal)} / {kcalGoal * 7} kcal
              </div>
              <div className="row between" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                <span className="row gap-4"><Flame size={12} color="var(--info)" /> Calorías de la semana</span>
                <span className="faint num">{Math.round(weekKcal)}/{kcalGoal * 7}</span>
              </div>
              <ProgressBar value={weekKcal} max={kcalGoal * 7} variant={weekKcal > kcalGoal * 7 ? 'warn' : 'info'} />
              <div className="row between" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                <span className="row gap-4"><Beef size={12} color="var(--danger)" /> Proteína de la semana</span>
                <span className="faint num">{Math.round(weekProtein)}/{proteinGoal * 7} g</span>
              </div>
              <ProgressBar value={weekProtein} max={proteinGoal * 7} variant={weekProtein >= proteinGoal * 7 ? 'success' : ''} />
            </div>
          </div>
        )}
      </Card>

      <MonthlyNutrition profile={profile} proteinGoal={proteinGoal} kcalGoal={kcalGoal} />
    </>
  )
}

function MonthlyNutrition({ proteinGoal, kcalGoal }) {
  const from = monthStart()
  const to = monthEnd()
  const { data: rows } = useNutritionRange(from, to)
  const byDay = useMemo(() => aggregateByDate(rows), [rows])

  const logged = [...byDay.values()]
  const days = logged.length
  const totKcal = logged.reduce((s, d) => s + d.kcal, 0)
  const totProt = logged.reduce((s, d) => s + d.protein_g, 0)
  const proteinDaysOk = logged.filter((d) => d.protein_g >= proteinGoal).length
  const kcalDaysOver = logged.filter((d) => d.kcal > kcalGoal).length
  const avgKcal = days ? Math.round(totKcal / days) : 0
  const avgProt = days ? Math.round(totProt / days) : 0

  return (
    <Card title={`Mes — ${monthLabel().replace(/^\w/, (c) => c.toUpperCase())}`}>
      {days === 0 ? (
        <Empty icon="🍽️" title="Sin registros este mes">Cargá comidas para ver tu progreso mensual.</Empty>
      ) : (
        <>
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
            <Stat label="Prom. proteína/día" value={`${avgProt}`} suffix={`/ ${proteinGoal} g`} color={avgProt >= proteinGoal ? 'var(--success)' : 'var(--text)'} />
            <Stat label="Prom. calorías/día" value={`${avgKcal}`} suffix={`/ ${kcalGoal}`} color={avgKcal > kcalGoal ? 'var(--warn)' : 'var(--text)'} />
          </div>
          <div className="row between mt-12" style={{ fontSize: '0.82rem' }}>
            <span className="pill success" style={{ width: 'fit-content' }}><Check size={13} /> {proteinDaysOk}/{days} días proteína OK</span>
            <span className="pill warn" style={{ width: 'fit-content' }}><AlertTriangle size={13} /> {kcalDaysOver}/{days} días excedido</span>
          </div>
          <p className="faint center mt-12" style={{ fontSize: '0.78rem' }}>{days} días registrados en el mes</p>
        </>
      )}
    </Card>
  )
}

// ─────────────────────── Entrenamiento ───────────────────────

function TrainingProgress({ profile }) {
  const { data: programDays } = useProgramDays(profile?.active_program_id)
  const { data: sessions } = useSessions()

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

  return (
    <>
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
    </>
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
