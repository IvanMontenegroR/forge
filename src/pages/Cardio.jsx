import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Footprints, Check, Zap } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile, useCardio, useStepsToday, qk } from '../data/hooks'
import { useAwards } from '../data/awards'
import * as db from '../data/db'
import { todayStr, prettyDate } from '../lib/dates'
import { XP } from '../lib/gamification'
import { Card, ProgressBar, Stepper, Spinner } from '../components/ui'

export default function Cardio() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { award, grantBadge, bumpQuest } = useAwards()
  const { data: profile } = useProfile()
  const { data: steps } = useStepsToday()
  const { data: logs } = useCardio()

  const [stepInput, setStepInput] = useState(steps || 0)
  const [hiit, setHiit] = useState({ duration_min: 18 })

  if (!profile) return <div className="page"><Spinner /></div>
  const goal = profile.step_goal || 9000

  async function saveSteps() {
    const n = Number(stepInput) || 0
    await db.setSteps(user.id, todayStr(), n)
    qc.invalidateQueries({ queryKey: qk.steps(user.id, todayStr()) })
    qc.invalidateQueries({ queryKey: qk.cardio(user.id) })
    if (n >= goal) {
      await award('steps_goal', XP.steps_goal, 'Meta de pasos cumplida', { oncePerDay: true })
      const st = await db.bumpDailyStreak(user.id, 'steps')
      qc.invalidateQueries({ queryKey: qk.streaks(user.id) })
      if (st?.current_count >= 7) await grantBadge('steps_week')
    }
  }

  async function addHiit() {
    await db.addCardio(user.id, { date: todayStr(), type: 'hiit', duration_min: Number(hiit.duration_min) || 15 })
    qc.invalidateQueries({ queryKey: qk.cardio(user.id) })
    await bumpQuest('hiit', 1)
  }

  const hiitThisWeek = (logs || []).filter((l) => l.type === 'hiit').length

  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">Cardio</p><h1>Caminadora & pasos</h1></div>

      <Card>
        <div className="row between">
          <div className="row gap-8"><Footprints size={20} color="var(--info)" /><strong>Pasos de hoy</strong></div>
          <span className="num" style={{ fontWeight: 800 }}>{(steps || 0).toLocaleString('es')} <span className="faint" style={{ fontSize: '0.8rem' }}>/ {goal.toLocaleString('es')}</span></span>
        </div>
        <ProgressBar value={steps || 0} max={goal} variant="info" />
        <div className="row gap-8 mt-16">
          <Stepper value={stepInput} step={500} min={0} max={50000} onChange={setStepInput} />
          <button className="btn btn-primary grow" onClick={saveSteps}><Check size={18} /> Guardar pasos</button>
        </div>
      </Card>

      <Card title="HIIT en caminadora">
        <p className="muted" style={{ fontSize: '0.86rem' }}>Meta: {profile.hiit_per_week || 2}/semana · esta semana: {hiitThisWeek}</p>
        <p className="faint" style={{ fontSize: '0.8rem', marginTop: 4 }}>Intervalos 1 min fuerte (8 km/h) / 1–2 min caminando, 15–20 min.</p>
        <div className="row gap-8 mt-12">
          <div className="col grow" style={{ gap: 4 }}>
            <span className="faint" style={{ fontSize: '0.78rem' }}>Duración (min)</span>
            <Stepper value={hiit.duration_min} step={1} min={5} max={60} onChange={(v) => setHiit({ duration_min: v })} />
          </div>
          <button className="btn btn-primary grow" onClick={addHiit} style={{ alignSelf: 'flex-end' }}><Zap size={18} /> Registrar HIIT</button>
        </div>
      </Card>

      {logs?.length > 0 && (
        <Card title="Historial">
          <div className="col">
            {logs.slice(0, 12).map((l) => (
              <div key={l.id} className="list-row">
                <span className="lead" style={{ width: 34, height: 34 }}>{l.type === 'hiit' ? <Zap size={16} color="var(--accent)" /> : <Footprints size={16} color="var(--info)" />}</span>
                <div className="grow">
                  <strong style={{ fontSize: '0.9rem' }}>{l.type === 'hiit' ? 'HIIT' : l.type === 'steps' ? 'Pasos' : 'Caminata'}</strong>
                  <span className="faint" style={{ display: 'block', fontSize: '0.78rem' }}>{prettyDate(l.date)}</span>
                </div>
                <span className="num faint">{l.type === 'steps' ? `${(l.steps || 0).toLocaleString('es')} pasos` : `${l.duration_min || 0} min`}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
