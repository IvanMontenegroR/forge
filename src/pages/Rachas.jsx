import { Dumbbell, Beef, Flame } from 'lucide-react'
import { useProfile, useTrainingStreak, useNutritionStreak } from '../data/hooks'
import { Card, Spinner } from '../components/ui'

export default function Rachas() {
  const { data: profile } = useProfile()
  const train = useTrainingStreak()
  const nut = useNutritionStreak()

  if (!profile) return <div className="page"><Spinner /></div>

  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">Rachas</p><h1>Constancia</h1></div>

      <StreakCard
        title="Nutrición" icon={Beef} color="var(--danger)" streak={nut}
        caption={`Días en los que te quedaste bajo tu techo de ${profile.target_kcal || 2050} kcal. Podés excederte hasta 2 días por semana sin cortarla.`}
      />
      <StreakCard
        title="Entrenamiento" icon={Dumbbell} color="var(--accent)" streak={train}
        caption="Cuenta tus días programados (lun/mar/vie). Los descansos no rompen la racha; podés faltar hasta 2 días programados por semana."
      />

      <div className="row gap-16 mt-8" style={{ justifyContent: 'center', fontSize: '0.74rem' }}>
        <span className="row gap-4"><Dot status="good" mini /> Cumplido</span>
        <span className="row gap-4"><Dot status="bad" mini /> Fallado</span>
        <span className="row gap-4"><Dot status="skip" mini /> Descanso/sin dato</span>
      </div>
    </div>
  )
}

function StreakCard({ title, icon: Icon, color, streak, caption }) {
  const on = streak.current > 0
  // últimos ~28 días en orden cronológico (el motor los devuelve hoy→atrás)
  const recent = (streak.days || []).slice(0, 28).reverse()
  return (
    <Card title={title}>
      <div className="row gap-16" style={{ alignItems: 'center', marginBottom: 14 }}>
        <Icon size={28} color={on ? color : 'var(--text-faint)'} />
        <div className="col" style={{ gap: 2 }}>
          <span className="num row gap-6" style={{ fontSize: '2rem', fontWeight: 800, color: on ? color : 'var(--text)', alignItems: 'baseline' }}>
            {on && <Flame size={20} color={color} />}{streak.current}<span className="faint" style={{ fontSize: '1rem' }}>días</span>
          </span>
          <span className="faint" style={{ fontSize: '0.8rem' }}>Récord: {streak.longest} días</span>
        </div>
      </div>
      <div className="row wrap gap-4">
        {recent.map((d) => <Dot key={d.date} status={d.status} date={d.date} />)}
      </div>
      <p className="faint mt-12" style={{ fontSize: '0.76rem' }}>{caption}</p>
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
