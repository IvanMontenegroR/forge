import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Check, Plus, Trophy, TrendingUp, Info, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile, useProgramDays, useTodaySession, useSessionSets, usePrevSets, qk } from '../data/hooks'
import * as db from '../data/db'
import { isoWeekday, todayStr } from '../lib/dates'
import { Card, Spinner, Stepper } from '../components/ui'

export default function Workout() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: profile } = useProfile()
  const { data: programDays } = useProgramDays(profile?.active_program_id)
  const { data: session, isLoading } = useTodaySession()
  const [creating, setCreating] = useState(false)

  const wd = isoWeekday()
  const todayPlan = useMemo(() => programDays?.find((d) => d.weekday === wd) || null, [programDays, wd])

  // Auto-crear la sesión del día si toca entrenar y no existe.
  useEffect(() => {
    if (!user || isLoading || session || creating) return
    if (todayPlan) {
      setCreating(true)
      db.createSession(user.id, { programDayId: todayPlan.id, title: todayPlan.name })
        .then(() => qc.invalidateQueries({ queryKey: qk.session(user.id, todayStr()) }))
        .finally(() => setCreating(false))
    }
  }, [user, isLoading, session, todayPlan, creating, qc])

  async function startFreeDay(dayId, title) {
    setCreating(true)
    await db.createSession(user.id, { programDayId: dayId, title })
    await qc.invalidateQueries({ queryKey: qk.session(user.id, todayStr()) })
    setCreating(false)
  }

  if (isLoading || creating) return <div className="page"><Spinner label="Preparando la sesión…" /></div>

  // Día sin sesión programada y sin sesión creada → elegir qué hacer.
  if (!session && !todayPlan) {
    return (
      <div className="page">
        <Header onBack={() => navigate('/')} title="Entrenamiento libre" />
        <Card>
          <p className="muted">Hoy no toca sesión programada. ¿Querés hacer una igual? Elegí un día del programa:</p>
          <div className="col gap-8 mt-12">
            {programDays?.map((d) => (
              <button key={d.id} className="btn btn-ghost btn-block" onClick={() => startFreeDay(d.id, d.name)} style={{ justifyContent: 'space-between' }}>
                <span>{d.name}</span><span className="faint">{d.focus}</span>
              </button>
            ))}
          </div>
        </Card>
      </div>
    )
  }

  if (!session) return <div className="page"><Spinner /></div>

  const dayPlan = programDays?.find((d) => d.id === session.program_day_id) || todayPlan
  return <ActiveSession session={session} dayPlan={dayPlan} profile={profile} navigate={navigate} />
}

function Header({ onBack, title, right }) {
  return (
    <div className="row between" style={{ marginBottom: 16 }}>
      <button className="btn btn-ghost btn-icon" onClick={onBack} aria-label="Volver"><ChevronLeft size={20} /></button>
      <strong>{title}</strong>
      <div style={{ width: 40 }}>{right}</div>
    </div>
  )
}

function ActiveSession({ session, dayPlan, profile, navigate }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: sessionSets } = useSessionSets(session.id)
  const [finishing, setFinishing] = useState(false)

  const exercises = dayPlan?.program_day_exercises || []
  const done = session.status === 'completed'

  const totalVolume = useMemo(() => {
    return (sessionSets || []).filter((s) => !s.is_warmup && s.done).reduce((sum, s) => sum + Number(s.weight_kg) * Number(s.reps), 0)
  }, [sessionSets])
  const completedSets = (sessionSets || []).filter((s) => s.done && !s.is_warmup).length

  async function finishSession() {
    setFinishing(true)
    try {
      await db.completeSession(session.id, { totalVolume, notes: null })
      qc.invalidateQueries({ queryKey: qk.session(user.id, todayStr()) })
      qc.invalidateQueries({ queryKey: qk.sessions(user.id) })
    } finally {
      setFinishing(false)
    }
  }

  return (
    <div className="page">
      <Header onBack={() => navigate('/')} title={dayPlan?.name || 'Entrenamiento'} />

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 16 }}>
        <Card style={{ padding: 12 }}><Stat label="Series hechas" value={completedSets} /></Card>
        <Card style={{ padding: 12 }}><Stat label="Volumen" value={Math.round(totalVolume)} suffix="kg" /></Card>
        <Card style={{ padding: 12 }}><Stat label="Ejercicios" value={exercises.length} /></Card>
      </div>

      {dayPlan?.notes && (
        <div className="pill info" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 12 }}>
          <Info size={14} /> {dayPlan.notes}
        </div>
      )}

      {exercises.map((pde) => (
        <ExerciseBlock
          key={pde.id}
          pde={pde}
          session={session}
          existing={(sessionSets || []).filter((s) => s.exercise_id === pde.exercise_id)}
          readOnly={done}
        />
      ))}

      {!done ? (
        <button className="btn btn-success btn-block btn-lg mt-16" onClick={finishSession} disabled={finishing || completedSets === 0}>
          {finishing ? 'Guardando…' : <><Check size={18} /> Terminar y guardar</>}
        </button>
      ) : (
        <div className="card center mt-16" style={{ borderColor: 'var(--success)' }}>
          <Trophy size={28} color="var(--gold)" />
          <strong className="mt-8" style={{ display: 'block' }}>Sesión completada</strong>
          <p className="muted mt-8">Volumen total: {Math.round(totalVolume)} kg · {completedSets} series</p>
          <button className="btn btn-ghost btn-block mt-16" onClick={() => navigate('/')}>Volver al inicio</button>
        </div>
      )}
    </div>
  )
}

function Stat({ value, label, suffix }) {
  return (
    <div className="stat">
      <span className="v">{value}{suffix && <span style={{ fontSize: '0.6em', color: 'var(--text-faint)' }}> {suffix}</span>}</span>
      <span className="l">{label}</span>
    </div>
  )
}

function ExerciseBlock({ pde, session, existing, readOnly }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const ex = pde.exercise
  const { data: prev } = usePrevSets(pde.exercise_id, session.id)
  const targetSets = pde.target_sets || 3
  const isTimed = ex?.muscle_group === 'core' && (ex?.equipment === 'peso corporal') && pde.rep_low >= 30

  // Sugerencia de doble progresión: si la sesión previa llegó al tope de
  // reps en TODAS las series, sugerir +2.5 kg.
  const prevTopWeight = (prev?.sets || []).reduce((m, s) => Math.max(m, Number(s.weight_kg)), 0)
  const prevAllTop = prev?.sets?.length >= targetSets && prev.sets.every((s) => Number(s.reps) >= pde.rep_high)
  const suggestWeight = prevAllTop ? prevTopWeight + 2.5 : prevTopWeight

  // Filas locales (sincronizan con DB al editar)
  const [rows, setRows] = useState([])
  useEffect(() => {
    const sorted = [...existing].sort((a, b) => a.set_number - b.set_number)
    if (sorted.length) {
      setRows(sorted.map((s) => ({ id: s.id, set_number: s.set_number, weight: Number(s.weight_kg), reps: Number(s.reps), done: s.done })))
    } else {
      const start = suggestWeight || 0
      setRows(Array.from({ length: targetSets }, (_, i) => ({ set_number: i + 1, weight: start, reps: pde.rep_low, done: false })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing.length, pde.id])

  async function persist(idx, patch) {
    const row = { ...rows[idx], ...patch }
    const next = rows.map((r, i) => (i === idx ? row : r))
    setRows(next)
    const payload = {
      ...(row.id ? { id: row.id } : {}),
      session_id: session.id, user_id: user.id, exercise_id: pde.exercise_id,
      set_number: row.set_number, weight_kg: row.weight || 0, reps: row.reps || 0,
      is_warmup: false, done: row.done,
    }
    const saved = await db.upsertSet(payload)
    if (!row.id) {
      setRows((cur) => cur.map((r, i) => (i === idx ? { ...r, id: saved.id } : r)))
    }
    qc.invalidateQueries({ queryKey: qk.sessionSets(session.id) })
  }

  function addSet() {
    setRows((cur) => [...cur, { set_number: cur.length + 1, weight: suggestWeight || 0, reps: pde.rep_low, done: false }])
  }

  async function removeRow(idx) {
    const row = rows[idx]
    if (row.id) await db.deleteSet(row.id)
    setRows((cur) => cur.filter((_, i) => i !== idx))
    qc.invalidateQueries({ queryKey: qk.sessionSets(session.id) })
  }

  return (
    <Card>
      <div className="row between">
        <div className="col" style={{ gap: 2 }}>
          <strong>{ex?.name}</strong>
          <span className="faint" style={{ fontSize: '0.78rem' }}>
            {targetSets} × {pde.rep_low === pde.rep_high ? pde.rep_low : `${pde.rep_low}–${pde.rep_high}`}{isTimed ? ' seg' : ' reps'}{pde.per_side ? ' c/lado' : ''}
          </span>
        </div>
        {pde.notes && <span className="pill accent" style={{ fontSize: '0.7rem' }}>{pde.notes}</span>}
      </div>

      {prevAllTop && !readOnly && (
        <div className="pill success mt-12" style={{ width: '100%', justifyContent: 'flex-start' }}>
          <TrendingUp size={14} /> La vez pasada llegaste al tope. Subí a {suggestWeight} kg.
        </div>
      )}

      <div className="col gap-8 mt-12">
        <div className="row faint" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 4 }}>
          <span style={{ width: 28 }}>#</span>
          <span style={{ width: 92 }}>Anterior</span>
          <span className="grow center">Kg</span>
          <span className="grow center">{isTimed ? 'Seg' : 'Reps'}</span>
          <span style={{ width: 40 }}></span>
        </div>
        {rows.map((r, idx) => {
          const prevSet = prev?.sets?.[idx]
          return (
            <div key={idx} className="row gap-8">
              <span className="num faint" style={{ width: 28, textAlign: 'center', fontWeight: 700 }}>{r.set_number}</span>
              <span className="num faint" style={{ width: 92, fontSize: '0.82rem' }}>
                {prevSet ? `${Number(prevSet.weight_kg)}×${prevSet.reps}` : '–'}
              </span>
              <div className="grow center">
                <Stepper value={r.weight} step={2.5} decimals={r.weight % 1 ? 1 : 0} onChange={(v) => persist(idx, { weight: v })} />
              </div>
              <div className="grow center">
                <Stepper value={r.reps} step={isTimed ? 5 : 1} onChange={(v) => persist(idx, { reps: v })} />
              </div>
              {!readOnly ? (
                <button className="check" data-on={r.done} aria-label="serie hecha" aria-pressed={r.done}
                  onClick={() => persist(idx, { done: !r.done })}><Check size={16} /></button>
              ) : (
                <span className="check" data-on={r.done}><Check size={16} /></span>
              )}
            </div>
          )
        })}
      </div>

      {!readOnly && (
        <div className="row gap-8 mt-12">
          <button className="btn btn-ghost btn-sm grow" onClick={addSet}><Plus size={15} /> Serie</button>
          {rows.length > 1 && (
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => removeRow(rows.length - 1)} aria-label="quitar última serie"><Trash2 size={15} /></button>
          )}
        </div>
      )}
    </Card>
  )
}
