import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Moon, Check, Star } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile, useSleep, qk } from '../data/hooks'
import * as db from '../data/db'
import { todayStr, prettyDate } from '../lib/dates'
import { Card, Stepper, Spinner } from '../components/ui'

export default function Sleep() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: profile } = useProfile()
  const { data: logs } = useSleep()

  const todayLog = logs?.find((l) => l.date === todayStr())
  const [hours, setHours] = useState(todayLog?.hours ?? 7.5)
  const [quality, setQuality] = useState(todayLog?.quality ?? 3)

  if (!profile) return <div className="page"><Spinner /></div>
  const goal = profile.sleep_goal_hours || 8

  async function save() {
    await db.upsertSleep(user.id, { date: todayStr(), hours: Number(hours), quality: Number(quality) })
    qc.invalidateQueries({ queryKey: qk.sleep(user.id) })
  }

  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">Sueño · área de foco</p><h1>¿Cómo dormiste?</h1></div>

      <Card>
        <div className="field">
          <label>Horas dormidas (meta {goal} h)</label>
          <div className="row gap-12">
            <Moon size={22} color="var(--xp)" />
            <Stepper value={hours} step={0.5} decimals={1} min={0} max={14} onChange={setHours} />
          </div>
        </div>
        <div className="field">
          <label>Calidad</label>
          <div className="row gap-8">
            {[1, 2, 3, 4, 5].map((q) => (
              <button key={q} className="btn btn-icon" onClick={() => setQuality(q)} aria-label={`calidad ${q}`}
                style={{ background: 'transparent', border: 'none', padding: 4 }}>
                <Star size={28} fill={q <= quality ? 'var(--gold)' : 'none'} color={q <= quality ? 'var(--gold)' : 'var(--text-faint)'} />
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary btn-block btn-lg" onClick={save}><Check size={18} /> Guardar</button>
      </Card>

      <Card title="Higiene del sueño">
        <ul className="muted" style={{ margin: 0, paddingLeft: 18, fontSize: '0.86rem', lineHeight: 1.7 }}>
          <li>Sin cafeína (ni Lipo6) después de las {profile.caffeine_cutoff_hour || 14}h.</li>
          <li>Horario fijo para acostarte y levantarte.</li>
          <li>Bajá pantallas y luces media hora antes.</li>
          <li>Luz del sol a la mañana para reordenar el reloj.</li>
        </ul>
      </Card>

      {logs?.length > 0 && (
        <Card title="Últimas noches">
          <div className="col">
            {logs.slice(0, 10).map((l) => (
              <div key={l.id} className="list-row">
                <div className="grow">
                  <strong style={{ fontSize: '0.9rem' }}>{prettyDate(l.date)}</strong>
                  <span className="faint" style={{ display: 'block', fontSize: '0.78rem' }}>
                    {'★'.repeat(l.quality || 0)}{'☆'.repeat(5 - (l.quality || 0))}
                  </span>
                </div>
                <span className="num" style={{ fontWeight: 700, color: Number(l.hours) >= goal ? 'var(--success)' : 'var(--text)' }}>{l.hours} h</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
