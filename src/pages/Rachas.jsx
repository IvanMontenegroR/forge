import { Dumbbell, Beef, Flame, Check } from 'lucide-react'
import { useProfile, useTrainingStreak, useNutritionStreak } from '../data/hooks'
import { Card, Spinner, ProgressBar } from '../components/ui'

export default function Rachas() {
  const { data: profile } = useProfile()
  const train = useTrainingStreak()
  const nut = useNutritionStreak()

  if (!profile) return <div className="page"><Spinner /></div>

  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">Rachas</p><h1>Constancia</h1></div>

      {/* Nutrición: días */}
      <NutritionStreakCard streak={nut} kcalGoal={profile.target_kcal || 2050} />

      <div className="row gap-16 mt-8" style={{ justifyContent: 'center', fontSize: '0.74rem', marginBottom: 16 }}>
        <span className="row gap-4"><Dot status="good" mini /> Cumplido</span>
        <span className="row gap-4"><Dot status="bad" mini /> Fallado</span>
        <span className="row gap-4"><Dot status="skip" mini /> Descanso/sin dato</span>
      </div>

      {/* Entrenamiento: semanas por frecuencia */}
      <TrainingStreakCard streak={train} />
    </div>
  )
}

function NutritionStreakCard({ streak, kcalGoal }) {
  const on = streak.current > 0
  const recent = (streak.days || []).slice(0, 28).reverse()
  return (
    <Card title="Nutrición">
      <div className="row gap-16" style={{ alignItems: 'center', marginBottom: 14 }}>
        <Beef size={28} color={on ? 'var(--danger)' : 'var(--text-faint)'} />
        <div className="col" style={{ gap: 2 }}>
          <span className="num row gap-6" style={{ fontSize: '2rem', fontWeight: 800, color: on ? 'var(--danger)' : 'var(--text)', alignItems: 'baseline' }}>
            {on && <Flame size={20} color="var(--danger)" />}{streak.current}<span className="faint" style={{ fontSize: '1rem' }}>días</span>
          </span>
          <span className="faint" style={{ fontSize: '0.8rem' }}>Récord: {streak.longest} días</span>
        </div>
      </div>
      <div className="row wrap gap-4">
        {recent.map((d) => <Dot key={d.date} status={d.status} date={d.date} />)}
      </div>
      <p className="faint mt-12" style={{ fontSize: '0.76rem' }}>
        Días en los que te quedaste bajo tu techo de {kcalGoal} kcal. Podés excederte hasta 2 días por semana sin cortarla.
      </p>
    </Card>
  )
}

function TrainingStreakCard({ streak }) {
  const on = streak.current > 0
  const weeks = [...(streak.weeks || [])].reverse() // cronológico
  return (
    <Card title="Entrenamiento">
      <div className="row gap-16" style={{ alignItems: 'center', marginBottom: 14 }}>
        <Dumbbell size={28} color={on ? 'var(--accent)' : 'var(--text-faint)'} />
        <div className="col" style={{ gap: 2 }}>
          <span className="num row gap-6" style={{ fontSize: '2rem', fontWeight: 800, color: on ? 'var(--accent)' : 'var(--text)', alignItems: 'baseline' }}>
            {on && <Flame size={20} color="var(--accent)" />}{streak.current}<span className="faint" style={{ fontSize: '1rem' }}>{streak.current === 1 ? 'semana' : 'semanas'}</span>
          </span>
          <span className="faint" style={{ fontSize: '0.8rem' }}>Récord: {streak.longest} · esta semana {streak.thisWeek}/{streak.goal}</span>
        </div>
      </div>

      <div className="col gap-8">
        {weeks.map((w) => (
          <div key={w.weekStart} className="col gap-4">
            <div className="row between" style={{ fontSize: '0.78rem' }}>
              <span className="row gap-4">
                {w.met ? <Check size={13} color="var(--success)" /> : <span style={{ width: 13 }} />}
                Semana del {w.weekStart.slice(8)}/{w.weekStart.slice(5, 7)}
              </span>
              <span className="faint num">{w.count}/{streak.goal}</span>
            </div>
            <ProgressBar value={w.count} max={streak.goal} variant={w.met ? 'success' : ''} />
          </div>
        ))}
      </div>
      <p className="faint mt-12" style={{ fontSize: '0.76rem' }}>
        Rutina rotativa: entrenás cualquier día y seguís la secuencia. La racha cuenta semanas seguidas con {streak.goal}+ entrenos.
      </p>
    </Card>
  )
}

function Dot({ status, date, mini }) {
  const bg = status === 'good' ? 'var(--success)' : status === 'bad' ? 'var(--warn)' : 'var(--surface-3)'
  if (mini) return <span style={{ width: 12, height: 12, borderRadius: 4, background: bg, display: 'inline-block' }} />
  return (
    <span title={`${date}: ${status}`} style={{ width: 22, height: 22, borderRadius: 6, background: bg, display: 'inline-grid', placeItems: 'center', fontSize: 10, color: status === 'skip' ? 'var(--text-faint)' : 'var(--bg)', fontWeight: 700 }}>
      {date.slice(8)}
    </span>
  )
}
