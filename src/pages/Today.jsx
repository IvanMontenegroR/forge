import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dumbbell, Moon, Beef, Pill, Footprints, Ruler, Sparkles, Camera,
  ChevronRight, Play, CheckCircle2, Coffee, Flame,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  useProfile, useProgramDays, useTodaySession, useNutritionToday,
  useSupplements, useSupplementLogs, useStepsToday,
  useBodyMetrics, useNutritionWeek, useTrainingStreak, useNutritionStreak,
} from '../data/hooks'
import { isoWeekday, todayStr, WEEKDAY_LONG, prettyDate, daysBetween } from '../lib/dates'
import { Card, ProgressBar, Spinner } from '../components/ui'

export default function Today() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { data: programDays } = useProgramDays(profile?.active_program_id)
  const { data: session } = useTodaySession()
  const { data: nutrition } = useNutritionToday()
  const { data: supplements } = useSupplements()
  const { data: supLogs } = useSupplementLogs()
  const { data: steps } = useStepsToday()
  const { data: metrics } = useBodyMetrics()
  const { data: nutWeek } = useNutritionWeek()
  const train = useTrainingStreak()
  const nut = useNutritionStreak()

  const wd = isoWeekday()
  const todayPlan = useMemo(() => {
    if (!programDays) return null
    return programDays.find((d) => d.weekday === wd) || null
  }, [programDays, wd])

  if (!profile) return <div className="page"><Spinner /></div>

  const proteinToday = (nutrition || []).reduce((s, n) => s + Number(n.protein_g) * Number(n.qty || 1), 0)
  const proteinGoal = profile.protein_goal_g || 145
  const kcalToday = (nutrition || []).reduce((s, n) => s + Number(n.kcal || 0) * Number(n.qty || 1), 0)
  const kcalGoal = profile.target_kcal || 2050
  const kcalWeek = nutWeek?.kcal || 0
  const kcalWeekGoal = kcalGoal * 7
  const proteinWeek = nutWeek?.protein_g || 0
  const proteinWeekGoal = proteinGoal * 7
  const activeSupps = (supplements || []).filter((s) => s.active)
  const suppsTaken = (supLogs || []).filter((l) => l.taken).length
  const stepGoal = profile.step_goal || 9000
  const lastMetric = metrics?.length ? metrics[metrics.length - 1] : null
  const photoDue = lastMetric ? daysBetween(lastMetric.date, todayStr()) >= (profile.photo_reminder_days || 14) : true

  const isOptional = todayPlan?.is_optional
  const sessionDone = session?.status === 'completed'

  return (
    <div className="page">
      <div className="page-head">
        <p className="eyebrow">{WEEKDAY_LONG[wd]} · {prettyDate(todayStr()).split(', ')[1]}</p>
        <h1>Hola, {profile.full_name?.split(' ')[0] || 'crack'}</h1>
      </div>

      {/* Rachas */}
      <Card title="Rachas" action={<button className="btn btn-sm btn-ghost" onClick={() => navigate('/rachas')}>Ver</button>}>
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
          <StreakTile icon={Beef} color="var(--danger)" label="Nutrición" current={nut.current} longest={nut.longest} />
          <StreakTile icon={Dumbbell} color="var(--accent)" label="Entrenamiento" current={train.current} longest={train.longest} />
        </div>
        <p className="faint mt-12" style={{ fontSize: '0.76rem' }}>Podés fallar 2 días por semana sin cortar la racha. Nutrición cuenta días bajo tu techo de {kcalGoal} kcal.</p>
      </Card>

      {/* Calorías (directamente debajo de las rachas) */}
      <Card title="Calorías" action={<button className="btn btn-sm btn-ghost" onClick={() => navigate('/nutrition')}>Registrar</button>}>
        <div className="col gap-12">
          <div className="col gap-4">
            <div className="row between">
              <span className="row gap-8" style={{ fontSize: '0.88rem', fontWeight: 600 }}><Flame size={15} color="var(--info)" /> Hoy</span>
              <span className="faint num" style={{ fontSize: '0.82rem' }}>{Math.round(kcalToday)} / {kcalGoal} kcal</span>
            </div>
            <ProgressBar value={kcalToday} max={kcalGoal} variant="info" />
          </div>
          <div className="col gap-4">
            <div className="row between">
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Semana (lun–dom)</span>
              <span className="faint num" style={{ fontSize: '0.82rem' }}>{Math.round(kcalWeek)} / {kcalWeekGoal} kcal</span>
            </div>
            <ProgressBar value={kcalWeek} max={kcalWeekGoal} variant={kcalVariant(kcalWeek, kcalWeekGoal)} />
          </div>
        </div>
      </Card>

      {/* Proteína (mismo formato que calorías) */}
      <Card title="Proteína" action={<button className="btn btn-sm btn-ghost" onClick={() => navigate('/nutrition')}>Registrar</button>}>
        <div className="col gap-12">
          <div className="col gap-4">
            <div className="row between">
              <span className="row gap-8" style={{ fontSize: '0.88rem', fontWeight: 600 }}><Beef size={15} color="var(--danger)" /> Hoy</span>
              <span className="faint num" style={{ fontSize: '0.82rem' }}>{Math.round(proteinToday)} / {proteinGoal} g</span>
            </div>
            <ProgressBar value={proteinToday} max={proteinGoal} variant={proteinToday >= proteinGoal ? 'success' : ''} />
          </div>
          <div className="col gap-4">
            <div className="row between">
              <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>Semana (lun–dom)</span>
              <span className="faint num" style={{ fontSize: '0.82rem' }}>{Math.round(proteinWeek)} / {proteinWeekGoal} g</span>
            </div>
            <ProgressBar value={proteinWeek} max={proteinWeekGoal} variant={proteinWeek >= proteinWeekGoal ? 'success' : ''} />
          </div>
        </div>
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
            <p className="muted mt-8" style={{ fontSize: '0.88rem' }}>La recuperación es donde crece el músculo. Los días de descanso no rompen tu racha de entreno.</p>
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

function StreakTile({ icon: Icon, color, label, current, longest }) {
  const on = current > 0
  return (
    <div className="row gap-12" style={{ background: 'var(--bg-elev)', borderRadius: 12, padding: 12 }}>
      <Icon size={22} color={on ? color : 'var(--text-faint)'} />
      <div className="col" style={{ gap: 0 }}>
        <span className="num row gap-4" style={{ fontSize: '1.5rem', fontWeight: 800, color: on ? color : 'var(--text)', alignItems: 'baseline' }}>
          {on && <Flame size={15} color={color} />}{current}<span className="faint" style={{ fontSize: '0.8rem' }}>d</span>
        </span>
        <span className="faint" style={{ fontSize: '0.72rem' }}>{label} · récord {longest}</span>
      </div>
    </div>
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
      {/* slot de barra siempre presente (oculto si no hay progreso) → todas las tiles igual alto */}
      <div className="bar mt-8" style={{ height: 6, visibility: progress != null ? 'visible' : 'hidden' }}>
        <span style={{ width: `${Math.min(100, (progress || 0) * 100)}%`, background: color }} />
      </div>
    </button>
  )
}
