import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Check, Plus, Trophy, TrendingUp, Info, Trash2, Film } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile, useProgramDays, useTodaySession, useSessions, useSessionSets, usePrevSets, qk } from '../data/hooks'
import * as db from '../data/db'
import { todayStr } from '../lib/dates'
import { nextRotationDay } from '../lib/program'
import { Card, Spinner, Stepper } from '../components/ui'

export default function Workout() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: profile } = useProfile()
  const { data: programDays } = useProgramDays(profile?.active_program_id)
  const { data: session, isLoading } = useTodaySession()
  const { data: sessions } = useSessions()
  const [creating, setCreating] = useState(false)

  // Día objetivo: el pedido por ?day=… o el próximo en la rotación.
  const dayParam = searchParams.get('day')
  const targetDay = useMemo(() => {
    if (dayParam && programDays) return programDays.find((d) => d.id === dayParam) || null
    return nextRotationDay(programDays, sessions)
  }, [dayParam, programDays, sessions])

  // Auto-crear la sesión del día objetivo si no existe una hoy.
  useEffect(() => {
    if (!user || isLoading || session || creating || !targetDay) return
    setCreating(true)
    db.createSession(user.id, { programDayId: targetDay.id, title: targetDay.name })
      .then(() => qc.invalidateQueries({ queryKey: qk.session(user.id, todayStr()) }))
      .finally(() => setCreating(false))
  }, [user, isLoading, session, targetDay, creating, qc])

  if (isLoading || creating) return <div className="page"><Spinner label="Preparando la sesión…" /></div>

  // Sin programa con días → nada para entrenar.
  if (!session && !targetDay) {
    return (
      <div className="page">
        <Header onBack={() => navigate('/')} title="Entrenamiento" />
        <Card>
          <p className="muted">No tenés un programa activo con días cargados. Generá o elegí uno desde tu perfil.</p>
          <button className="btn btn-ghost btn-block mt-12" onClick={() => navigate('/profile')}>Ir a Programa</button>
        </Card>
      </div>
    )
  }

  if (!session) return <div className="page"><Spinner /></div>

  const dayPlan = programDays?.find((d) => d.id === session.program_day_id) || targetDay
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

  const [showGif, setShowGif] = useState(false)

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

      {ex?.demo_url && (
        <div className="mt-8">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowGif((v) => !v)} style={{ border: 'none', color: 'var(--accent)', paddingLeft: 0 }}>
            <Film size={14} /> {showGif ? 'Ocultar demostración' : 'Ver cómo se hace'}
          </button>
          {showGif && (
            <img src={ex.demo_url} alt={ex.name} loading="lazy"
              style={{ width: '100%', maxWidth: 320, borderRadius: 12, marginTop: 8, background: 'var(--surface-2)', display: 'block' }} />
          )}
        </div>
      )}

      {prevAllTop && !readOnly && (
        <div className="pill success mt-12" style={{ width: '100%', justifyContent: 'flex-start' }}>
          <TrendingUp size={14} /> La vez pasada llegaste al tope. Subí a {suggestWeight} kg.
        </div>
      )}

      {!prev && !readOnly && (
        <div className="pill info mt-12" style={{ width: '100%', justifyContent: 'flex-start' }}>
          <Info size={14} /> Primera vez: elegí un peso donde la última repetición te cueste (que te queden ~2 en reserva), no el mínimo. Ajustás en la próxima.
        </div>
      )}

      <div className="col gap-10 mt-12">
        {rows.map((r, idx) => {
          const prevSet = prev?.sets?.[idx]
          return (
            <div key={idx} className="col gap-8" style={{ padding: '10px 0', borderBottom: idx < rows.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div className="row between">
                <div className="col" style={{ gap: 0 }}>
                  <strong style={{ fontSize: '0.92rem' }}>Serie {r.set_number}</strong>
                  <span className="faint num" style={{ fontSize: '0.74rem' }}>Anterior: {prevSet ? `${Number(prevSet.weight_kg)} kg × ${prevSet.reps}` : '—'}</span>
                </div>
                {!readOnly ? (
                  <button className="check" data-on={r.done} aria-label="serie hecha" aria-pressed={r.done}
                    onClick={() => persist(idx, { done: !r.done })}><Check size={16} /></button>
                ) : (
                  <span className="check" data-on={r.done}><Check size={16} /></span>
                )}
              </div>
              <div className="row gap-12">
                <div className="col grow gap-4">
                  <span className="faint" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Peso (kg)</span>
                  <Stepper value={r.weight} step={2.5} decimals={r.weight % 1 ? 1 : 0} onChange={(v) => persist(idx, { weight: v })} />
                </div>
                <div className="col grow gap-4">
                  <span className="faint" style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{isTimed ? 'Segundos' : 'Reps'}</span>
                  <Stepper value={r.reps} step={isTimed ? 5 : 1} onChange={(v) => persist(idx, { reps: v })} />
                </div>
              </div>
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
