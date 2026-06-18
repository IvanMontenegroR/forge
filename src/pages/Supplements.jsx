import { useQueryClient } from '@tanstack/react-query'
import { Check, Pill, Flame, Clock, AlertTriangle, Power } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile, useSupplements, useSupplementLogs, useStreaks, qk } from '../data/hooks'
import { useAwards } from '../data/awards'
import * as db from '../data/db'
import { todayStr } from '../lib/dates'
import { XP } from '../lib/gamification'
import { Card, Spinner } from '../components/ui'

export default function Supplements() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { award, grantBadge, bumpQuest } = useAwards()
  const { data: profile } = useProfile()
  const { data: supps } = useSupplements()
  const { data: logs } = useSupplementLogs()
  const { data: streaks } = useStreaks()

  if (!profile || !supps) return <div className="page"><Spinner /></div>

  const active = supps.filter((s) => s.active)
  const optional = supps.filter((s) => !s.active)
  const takenIds = new Set((logs || []).filter((l) => l.taken).map((l) => l.user_supplement_id))
  const creatineStreak = streaks?.find((s) => s.kind === 'creatine')?.current_count || 0
  const allTaken = active.length > 0 && active.every((s) => takenIds.has(s.id))

  async function toggle(s) {
    const willTake = !takenIds.has(s.id)
    await db.toggleSupplementLog(user.id, s.id, todayStr(), willTake)
    qc.invalidateQueries({ queryKey: qk.supLogs(user.id, todayStr()) })

    if (s.track_streak && willTake) {
      const st = await db.bumpDailyStreak(user.id, 'creatine')
      qc.invalidateQueries({ queryKey: qk.streaks(user.id) })
      await award('creatine', XP.creatine, 'Creatina del día', { oncePerDay: true })
      await bumpQuest('creatine', 1)
      if (st?.current_count >= 30) await grantBadge('creatine_30')
    }
    // ¿todos los activos tomados?
    const nowTaken = new Set(takenIds)
    willTake ? nowTaken.add(s.id) : nowTaken.delete(s.id)
    if (active.every((x) => nowTaken.has(x.id))) {
      await award('supplements_all', XP.supplements_all, 'Suplementos completos', { oncePerDay: true })
    }
  }

  async function toggleActive(s) {
    await db.updateSupplement(s.id, { active: !s.active })
    qc.invalidateQueries({ queryKey: qk.supplements(user.id) })
  }

  async function toggleLoading(s) {
    await db.updateSupplement(s.id, { loading_phase: !s.loading_phase })
    qc.invalidateQueries({ queryKey: qk.supplements(user.id) })
  }

  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">Suplementos</p><h1>Checklist de hoy</h1></div>

      <Card>
        <div className="row between">
          <div className="row gap-8"><Flame size={20} color="var(--streak)" /><strong>Racha de creatina</strong></div>
          <span className="num" style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--streak)' }}>{creatineStreak} <span className="faint" style={{ fontSize: '0.8rem' }}>días</span></span>
        </div>
        {allTaken && <p className="pill success mt-12" style={{ width: '100%', justifyContent: 'flex-start' }}><Check size={14} /> Todo tomado hoy</p>}
      </Card>

      <Card title="Activos">
        <div className="col">
          {active.map((s) => (
            <SuppRow key={s.id} s={s} taken={takenIds.has(s.id)} onToggle={() => toggle(s)} onLoading={s.track_streak ? () => toggleLoading(s) : null} />
          ))}
        </div>
      </Card>

      {optional.length > 0 && (
        <Card title="Opcionales (apagados)">
          <div className="col">
            {optional.map((s) => (
              <div key={s.id} className="list-row">
                <span className="lead" style={{ width: 34, height: 34, opacity: 0.5 }}><Pill size={16} /></span>
                <div className="grow">
                  <strong style={{ fontSize: '0.92rem' }}>{s.name}</strong>
                  <span className="faint" style={{ display: 'block', fontSize: '0.78rem' }}>{s.dose} · {s.timing}</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(s)}><Power size={14} /> Activar</button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="faint center mt-16" style={{ fontSize: '0.8rem' }}>
        Higiene del sueño: sin cafeína (ni Lipo6) después de las {profile.caffeine_cutoff_hour || 14}h.
      </p>
    </div>
  )
}

function SuppRow({ s, taken, onToggle, onLoading }) {
  const cutoffWarn = s.cutoff_hour && new Date().getHours() >= s.cutoff_hour
  return (
    <div className="list-row">
      <span className="lead" style={{ width: 34, height: 34, background: taken ? 'var(--success-soft)' : 'var(--surface-2)', color: taken ? 'var(--success)' : 'var(--text-muted)' }}><Pill size={16} /></span>
      <div className="grow">
        <strong style={{ fontSize: '0.95rem' }}>{s.name}</strong>
        <span className="faint row gap-4" style={{ fontSize: '0.78rem' }}><Clock size={11} /> {s.dose} · {s.timing}</span>
        {s.loading_phase && <span className="pill warn" style={{ fontSize: '0.68rem', marginTop: 4 }}>Fase de carga</span>}
        {cutoffWarn && <span className="pill" style={{ color: 'var(--danger)', background: 'var(--danger-soft)', fontSize: '0.68rem', marginTop: 4 }}><AlertTriangle size={11} /> Pasó el horario límite ({s.cutoff_hour}h)</span>}
      </div>
      <div className="row gap-8">
        {onLoading && (
          <button className="chip btn-sm" aria-pressed={s.loading_phase} onClick={onLoading} title="Fase de carga" style={{ fontSize: '0.72rem' }}>Carga</button>
        )}
        <button className="check" data-on={taken} aria-pressed={taken} aria-label={`marcar ${s.name}`} onClick={onToggle}><Check size={16} /></button>
      </div>
    </div>
  )
}
