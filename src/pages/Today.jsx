import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dumbbell, Moon, Beef, Pill, Footprints, Ruler, Sparkles, Camera,
  ChevronRight, Play, CheckCircle2, Flame,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  useProfile, useProgramDays, useTodaySession, useNutritionToday,
  useSupplements, useSupplementLogs, useStepsToday,
  useBodyMetrics, useTrainingStreak, useNutritionStreak, useSessions,
} from '../data/hooks'
import { isoWeekday, todayStr, WEEKDAY_LONG, prettyDate, daysBetween } from '../lib/dates'
import { nextRotationDay } from '../lib/program'
import { Card, ProgressBar, Spinner } from '../components/ui'

export default function Today() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { data: programDays } = useProgramDays(profile?.active_program_id)
  const { data: session } = useTodaySession()
  const { data: sessions } = useSessions()
  const { data: nutrition } = useNutritionToday()
  const { data: supplements } = useSupplements()
  const { data: supLogs } = useSupplementLogs()
  const { data: steps } = useStepsToday()
  const { data: metrics } = useBodyMetrics()
  const train = useTrainingStreak()
  const nut = useNutritionStreak()
  const [pickDay, setPickDay] = useState(false)

  const wd = isoWeekday()
  const nextDay = useMemo(() => nextRotationDay(programDays, sessions), [programDays, sessions])

  if (!profile) return <div className="page"><Spinner /></div>

  const proteinToday = (nutrition || []).reduce((s, n) => s + Number(n.protein_g) * Number(n.qty || 1), 0)
  const proteinGoal = profile.protein_goal_g || 145
  const kcalToday = (nutrition || []).reduce((s, n) => s + Number(n.kcal || 0) * Number(n.qty || 1), 0)
  const kcalGoal = profile.target_kcal || 2050
  const activeSupps = (supplements || []).filter((s) => s.active)
  const suppsTaken = (supLogs || []).filter((l) => l.taken).length
  const stepGoal = profile.step_goal || 9000
  const lastMetric = metrics?.length ? metrics[metrics.length - 1] : null
  const photoDue = lastMetric ? daysBetween(lastMetric.date, todayStr()) >= (profile.photo_reminder_days || 14) : true

  const sessionDone = session?.status === 'completed'
  const dayList = [...(programDays || [])].sort((a, b) => a.order_index - b.order_index)

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">{WEEKDAY_LONG[wd]} · {prettyDate(todayStr()).split(', ')[1]}</p>
        <h1>Hola, {profile.full_name?.split(' ')[0] || 'crack'}</h1>
      </div>

      {/* Rachas: cuadritos de nutrición + barra de la semana actual de entreno */}
      <Card title="Rachas" action={<button className="btn btn-sm btn-ghost" onClick={() => navigate('/rachas')}>Ver</button>}>
        {/* Nutrición */}
        <div className="row between" style={{ marginBottom: 10 }}>
          <div className="row gap-10">
            <Beef size={22} color={nut.current > 0 ? 'var(--danger)' : 'var(--text-faint)'} />
            <span className="num row gap-4" style={{ fontSize: '1.4rem', fontWeight: 800, color: nut.current > 0 ? 'var(--danger)' : 'var(--text)', alignItems: 'baseline' }}>
              {nut.current > 0 && <Flame size={15} color="var(--danger)" />}{nut.current}<span className="faint" style={{ fontSize: '0.8rem' }}>días</span>
            </span>
          </div>
          <span className="faint" style={{ fontSize: '0.74rem' }}>Nutrición · récord {nut.longest}</span>
        </div>
        <div className="row wrap gap-4">
          {(nut.days || []).slice(0, 21).reverse().map((d) => <Dot key={d.date} status={d.status} date={d.date} />)}
        </div>

        {/* Entrenamiento: barra de la semana actual */}
        <div className="row between" style={{ marginTop: 18, marginBottom: 8 }}>
          <div className="row gap-10">
            <Dumbbell size={22} color={train.current > 0 ? 'var(--accent)' : 'var(--text-faint)'} />
            <span className="num row gap-4" style={{ fontSize: '1.4rem', fontWeight: 800, color: train.current > 0 ? 'var(--accent)' : 'var(--text)', alignItems: 'baseline' }}>
              {train.current > 0 && <Flame size={15} color="var(--accent)" />}{train.current}<span className="faint" style={{ fontSize: '0.8rem' }}>{train.current === 1 ? 'sem' : 'sem'}</span>
            </span>
          </div>
          <span className="faint num" style={{ fontSize: '0.78rem' }}>Esta semana {train.thisWeek}/{train.goal}</span>
        </div>
        <ProgressBar value={train.thisWeek} max={train.goal} variant={train.thisWeek >= train.goal ? 'success' : 'accent'} />
      </Card>

      {/* Nutrición hoy: calorías + proteína (solo hoy) */}
      <Card title="Nutrición hoy" action={<button className="btn btn-sm btn-ghost" onClick={() => navigate('/nutrition')}>Registrar</button>}>
        <div className="col gap-12">
          <div className="col gap-4">
            <div className="row between">
              <span className="row gap-8" style={{ fontSize: '0.88rem', fontWeight: 600 }}><Flame size={15} color="var(--info)" /> Calorías</span>
              <span className="faint num" style={{ fontSize: '0.82rem' }}>{Math.round(kcalToday)} / {kcalGoal} kcal</span>
            </div>
            <ProgressBar value={kcalToday} max={kcalGoal} variant={kcalVariant(kcalToday, kcalGoal)} />
          </div>
          <div className="col gap-4">
            <div className="row between">
              <span className="row gap-8" style={{ fontSize: '0.88rem', fontWeight: 600 }}><Beef size={15} color="var(--danger)" /> Proteína</span>
              <span className="faint num" style={{ fontSize: '0.82rem' }}>{Math.round(proteinToday)} / {proteinGoal} g</span>
            </div>
            <ProgressBar value={proteinToday} max={proteinGoal} variant={proteinToday >= proteinGoal ? 'success' : ''} />
          </div>
        </div>
      </Card>

      {/* Entrenamiento (rutina rotativa) */}
      <Card title="Entrenamiento">
        {session ? (
          <>
            <div className="row between">
              <div className="row gap-12">
                <span className="lead" style={{ width: 44, height: 44, background: 'var(--accent-soft)', color: 'var(--accent)' }}><Dumbbell size={22} /></span>
                <div className="col" style={{ gap: 2 }}>
                  <strong style={{ fontSize: '1.05rem' }}>{session.title || 'Entrenamiento'}</strong>
                  <span className="muted" style={{ fontSize: '0.84rem' }}>{sessionDone ? 'Completada hoy' : 'En progreso'}</span>
                </div>
              </div>
              {sessionDone && <CheckCircle2 size={24} color="var(--success)" />}
            </div>
            <button className="btn btn-primary btn-block btn-lg mt-16" onClick={() => navigate('/workout')}>
              {sessionDone ? <><CheckCircle2 size={18} /> Ver sesión</> : <><Play size={18} /> Continuar</>}
            </button>
          </>
        ) : nextDay ? (
          <>
            <div className="row gap-12">
              <span className="lead" style={{ width: 44, height: 44, background: 'var(--accent-soft)', color: 'var(--accent)' }}><Dumbbell size={22} /></span>
              <div className="col" style={{ gap: 2 }}>
                <span className="faint" style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase' }}>Próximo</span>
                <strong style={{ fontSize: '1.05rem' }}>{nextDay.name}</strong>
                <span className="muted" style={{ fontSize: '0.84rem' }}>{nextDay.focus}</span>
              </div>
            </div>
            <div className="row wrap gap-8 mt-12">
              {nextDay.program_day_exercises?.slice(0, 4).map((pde) => (
                <span key={pde.id} className="pill">{pde.exercise?.name}</span>
              ))}
              {nextDay.program_day_exercises?.length > 4 && (
                <span className="pill">+{nextDay.program_day_exercises.length - 4}</span>
              )}
            </div>
            <button className="btn btn-primary btn-block btn-lg mt-16" onClick={() => navigate('/workout')}>
              <Play size={18} /> Empezar entrenamiento
            </button>
            <button className="btn btn-ghost btn-block btn-sm mt-8" onClick={() => setPickDay((v) => !v)} style={{ justifyContent: 'space-between' }}>
              <span>Elegir otro día</span>
              <ChevronRight size={16} style={{ transform: pickDay ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
            </button>
            {pickDay && (
              <div className="col gap-8 mt-8">
                {dayList.map((d) => (
                  <button key={d.id} className="list-row" onClick={() => navigate(`/workout?day=${d.id}`)}
                    style={{ background: d.id === nextDay.id ? 'var(--accent-soft)' : 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10, padding: 12, cursor: 'pointer', textAlign: 'left' }}>
                    <div className="grow">
                      <strong style={{ fontSize: '0.9rem' }}>{d.name}</strong>
                      {d.focus && <span className="faint" style={{ display: 'block', fontSize: '0.78rem' }}>{d.focus}</span>}
                    </div>
                    {d.id === nextDay.id && <span className="pill accent" style={{ fontSize: '0.66rem' }}>próximo</span>}
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="center" style={{ padding: '8px 0' }}>
            <strong>No tenés un programa activo</strong>
            <p className="muted mt-8" style={{ fontSize: '0.88rem' }}>Generá o elegí uno desde tu perfil para arrancar.</p>
            <button className="btn btn-ghost btn-block mt-16" onClick={() => navigate('/profile')}>Ir a Programa</button>
          </div>
        )}
      </Card>

      {/* Accesos rápidos */}
      <div className="stat-grid mt-16" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <QuickTile icon={Beef} color="var(--danger)" label="Proteína" value={`${Math.round(proteinToday)}/${proteinGoal} g`} progress={proteinToday / proteinGoal} onClick={() => navigate('/nutrition')} />
        <QuickTile icon={Pill} color="var(--success)" label="Suplementos" value={`${suppsTaken}/${activeSupps.length}`} progress={activeSupps.length ? suppsTaken / activeSupps.length : 0} onClick={() => navigate('/supplements')} />
        <QuickTile icon={Footprints} color="var(--info)" label="Pasos" value={`${(steps || 0).toLocaleString('es')}`} progress={(steps || 0) / stepGoal} onClick={() => navigate('/cardio')} />
        <QuickTile icon={Moon} color="var(--xp)" label="Sueño" value="Registrar" onClick={() => navigate('/sleep')} />
      </div>

      <div className="stat-grid mt-12" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <QuickTile icon={Ruler} color="var(--warn)" label="Métricas" value={lastMetric ? `${lastMetric.weight_kg ?? '–'} kg` : 'Registrar'} onClick={() => navigate('/metrics')} />
        <QuickTile icon={Sparkles} color="var(--accent)" label="Coach IA" value="Analizar" onClick={() => navigate('/coach')} />
      </div>

      {photoDue && (
        <Card className="mt-16">
          <div className="row gap-12">
            <span className="lead" style={{ width: 44, height: 44, background: 'var(--warn-soft)', color: 'var(--warn)' }}><Camera size={20} /></span>
            <div className="grow">
              <strong>Foto de progreso</strong>
              <p className="muted" style={{ fontSize: '0.82rem' }}>Tocan tus fotos cada {profile.photo_reminder_days || 14} días. Misma luz y pose.</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

// Color de la barra de calorías según cercanía al tope: azul → ámbar → rojo.
function kcalVariant(value, max) {
  const r = max ? value / max : 0
  if (r > 1) return 'danger'
  if (r >= 0.8) return 'warn'
  return 'info'
}

function Dot({ status, date }) {
  const bg = status === 'good' ? 'var(--success)' : status === 'bad' ? 'var(--warn)' : 'var(--surface-3)'
  return (
    <span title={`${date}: ${status}`} style={{ width: 20, height: 20, borderRadius: 6, background: bg, display: 'inline-grid', placeItems: 'center', fontSize: 9, color: status === 'skip' ? 'var(--text-faint)' : 'var(--bg)', fontWeight: 700 }}>
      {date.slice(8)}
    </span>
  )
}

function QuickTile({ icon: Icon, color, label, value, progress, onClick }) {
  return (
    <button className="card" onClick={onClick} style={{ cursor: 'pointer', textAlign: 'left', padding: 14, display: 'flex', flexDirection: 'column' }}>
      <div className="row between">
        <span className="lead" style={{ width: 36, height: 36, background: 'var(--surface-2)', color }}><Icon size={18} /></span>
        <ChevronRight size={18} color="var(--text-faint)" />
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 12 }}>
        <div className="num" style={{ fontSize: '1.15rem', fontWeight: 800 }}>{value}</div>
        <div className="faint" style={{ fontSize: '0.78rem', fontWeight: 600 }}>{label}</div>
      </div>
      <div className="bar mt-8" style={{ height: 6, visibility: progress != null ? 'visible' : 'hidden' }}>
        <span style={{ width: `${Math.min(100, (progress || 0) * 100)}%`, background: color }} />
      </div>
    </button>
  )
}
