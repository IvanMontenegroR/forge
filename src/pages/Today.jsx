import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dumbbell, Moon, Beef, Pill, Footprints, Ruler, Sparkles, Camera,
  ChevronRight, Play, CheckCircle2, Coffee, Zap,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  useProfile, useProgramDays, useTodaySession, useNutritionToday,
  useSupplements, useSupplementLogs, useStepsToday,
  useWeeklyQuests, useBodyMetrics,
} from '../data/hooks'
import { useAwards } from '../data/awards'
import { ensureStreaks, ensureWeeklyQuests } from '../data/bootstrap'
import { isoWeekday, todayStr, WEEKDAY_LONG, prettyDate, daysBetween } from '../lib/dates'
import { levelFromXp, muscleMemoryState } from '../lib/gamification'
import { Card, Stat, ProgressBar, Ring, Spinner } from '../components/ui'

export default function Today() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { award } = useAwards()
  const { data: profile } = useProfile()
  const { data: programDays } = useProgramDays(profile?.active_program_id)
  const { data: session } = useTodaySession()
  const { data: nutrition } = useNutritionToday()
  const { data: supplements } = useSupplements()
  const { data: supLogs } = useSupplementLogs()
  const { data: steps } = useStepsToday()
  const { data: quests } = useWeeklyQuests()
  const { data: metrics } = useBodyMetrics()

  // asegurar filas base (cuentas seedeadas por script o nuevas)
  useEffect(() => {
    if (user && profile) {
      ensureStreaks(user.id)
      ensureWeeklyQuests(user.id, profile)
    }
  }, [user, profile])

  const wd = isoWeekday()
  const todayPlan = useMemo(() => {
    if (!programDays) return null
    return programDays.find((d) => d.weekday === wd) || null
  }, [programDays, wd])

  if (!profile) return <div className="page"><Spinner /></div>

  const lvl = levelFromXp(profile.xp || 0)
  const mm = muscleMemoryState(profile.muscle_memory_start, profile.muscle_memory_days, todayStr())
  const proteinToday = (nutrition || []).reduce((s, n) => s + Number(n.protein_g) * Number(n.qty || 1), 0)
  const proteinGoal = profile.protein_goal_g || 145
  const activeSupps = (supplements || []).filter((s) => s.active)
  const suppsTaken = (supLogs || []).filter((l) => l.taken).length
  const stepGoal = profile.step_goal || 9000
  const lastMetric = metrics?.length ? metrics[metrics.length - 1] : null
  const photoDue = lastMetric ? daysBetween(lastMetric.date, todayStr()) >= (profile.photo_reminder_days || 14) : true

  const isOptional = todayPlan?.is_optional
  const sessionDone = session?.status === 'completed'

  async function markRest() {
    await award('rest_day', 10, 'Descanso respetado', { oncePerDay: true })
  }

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">{WEEKDAY_LONG[wd]} · {prettyDate(todayStr()).split(',')[0]}</p>
        <h1>Hola, {profile.full_name?.split(' ')[0] || 'crack'}</h1>
      </div>

      {/* XP / nivel */}
      <Card>
        <div className="row between">
          <div className="row gap-12">
            <Ring progress={lvl.progress} size={52} stroke={6} color={lvl.rank.color}>
              <span style={{ fontSize: 16 }}>{lvl.level}</span>
            </Ring>
            <div className="col" style={{ gap: 2 }}>
              <strong style={{ color: lvl.rank.color }}>{lvl.rank.name}</strong>
              <span className="faint" style={{ fontSize: '0.8rem' }}>{lvl.intoLevel} / {lvl.span} XP · faltan {lvl.toNext}</span>
            </div>
          </div>
          {mm.active && (
            <span className="pill xp" title="Multiplicador de XP activo"><Zap size={14} /> x{mm.multiplier}</span>
          )}
        </div>
        <div className="bar xp mt-12"><span style={{ width: `${lvl.progress * 100}%` }} /></div>
      </Card>

      {/* Sesión de hoy */}
      <Card title="Tu sesión de hoy">
        {todayPlan ? (
          <>
            <div className="row between">
              <div className="row gap-12">
                <span className="lead" style={{ width: 44, height: 44, background: 'var(--accent-soft)', color: 'var(--accent)' }}><Dumbbell size={22} /></span>
                <div className="col" style={{ gap: 2 }}>
                  <strong style={{ fontSize: '1.05rem' }}>{todayPlan.name}</strong>
                  <span className="muted" style={{ fontSize: '0.84rem' }}>{todayPlan.focus}</span>
                </div>
              </div>
              {sessionDone && <CheckCircle2 size={24} color="var(--success)" />}
            </div>
            {isOptional && <p className="pill warn mt-12" style={{ width: '100%', justifyContent: 'flex-start' }}>Día opcional — solo si tenés ganas</p>}
            <div className="row wrap gap-8 mt-12">
              {todayPlan.program_day_exercises?.slice(0, 4).map((pde) => (
                <span key={pde.id} className="pill">{pde.exercise?.name}</span>
              ))}
              {todayPlan.program_day_exercises?.length > 4 && (
                <span className="pill">+{todayPlan.program_day_exercises.length - 4}</span>
              )}
            </div>
            <button className="btn btn-primary btn-block btn-lg mt-16" onClick={() => navigate('/workout')}>
              {sessionDone ? <><CheckCircle2 size={18} /> Ver sesión</> : session ? <><Play size={18} /> Continuar</> : <><Play size={18} /> Empezar entrenamiento</>}
            </button>
          </>
        ) : (
          <div className="center" style={{ padding: '8px 0' }}>
            <span className="lead" style={{ width: 48, height: 48, margin: '0 auto 10px', background: 'var(--info-soft)', color: 'var(--info)' }}><Coffee size={24} /></span>
            <strong>Día de descanso</strong>
            <p className="muted mt-8" style={{ fontSize: '0.88rem' }}>La recuperación es donde crece el músculo. Tu racha de entreno no se rompe hoy.</p>
            <button className="btn btn-ghost btn-block mt-16" onClick={markRest}>Registrar descanso (+10 XP)</button>
          </div>
        )}
      </Card>

      {/* Muscle memory */}
      {mm.active && (
        <Card>
          <div className="row between">
            <div className="col" style={{ gap: 2 }}>
              <span className="row gap-8" style={{ fontWeight: 700 }}><Zap size={16} color="var(--xp)" /> Muscle Memory</span>
              <span className="muted" style={{ fontSize: '0.82rem' }}>Ventana de resultados rápidos · XP x{mm.multiplier}</span>
            </div>
            <Stat value={mm.daysLeft} label="días" color="var(--xp)" />
          </div>
          <div className="bar xp mt-12"><span style={{ width: `${((mm.total - mm.daysLeft) / mm.total) * 100}%` }} /></div>
        </Card>
      )}

      {/* Misiones de la semana */}
      {quests?.length > 0 && (
        <Card title="Misiones de la semana" action={<button className="btn btn-sm btn-ghost" onClick={() => navigate('/achievements')}>Ver todas</button>}>
          <div className="col gap-12">
            {quests.slice(0, 3).map((q) => (
              <div key={q.id} className="col gap-4">
                <div className="row between">
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, textDecoration: q.completed ? 'line-through' : 'none', opacity: q.completed ? 0.6 : 1 }}>{q.title}</span>
                  <span className="faint num" style={{ fontSize: '0.8rem' }}>{q.progress}/{q.target}</span>
                </div>
                <ProgressBar value={q.progress} max={q.target} variant={q.completed ? 'success' : ''} />
              </div>
            ))}
          </div>
        </Card>
      )}

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
            <span className="lead" style={{ background: 'var(--warn-soft)', color: 'var(--warn)' }}><Camera size={20} /></span>
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

function QuickTile({ icon: Icon, color, label, value, progress, onClick }) {
  return (
    <button className="card" onClick={onClick} style={{ cursor: 'pointer', textAlign: 'left', padding: 14 }}>
      <div className="row between">
        <span className="lead" style={{ width: 36, height: 36, background: 'var(--surface-2)', color }}><Icon size={18} /></span>
        <ChevronRight size={18} color="var(--text-faint)" />
      </div>
      <div className="mt-12">
        <div className="num" style={{ fontSize: '1.15rem', fontWeight: 800 }}>{value}</div>
        <div className="faint" style={{ fontSize: '0.78rem', fontWeight: 600 }}>{label}</div>
      </div>
      {progress != null && <div className="bar mt-8" style={{ height: 6 }}><span style={{ width: `${Math.min(100, progress * 100)}%`, background: color }} /></div>}
    </button>
  )
}
