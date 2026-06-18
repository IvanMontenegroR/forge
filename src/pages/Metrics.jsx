import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Check, TrendingUp, TrendingDown, Scale } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile, useBodyMetrics, qk } from '../data/hooks'
import { useAwards } from '../data/awards'
import * as db from '../data/db'
import { todayStr } from '../lib/dates'
import { XP } from '../lib/gamification'
import { Card, Stepper, Spinner, Empty } from '../components/ui'

export default function Metrics() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { award, grantBadge } = useAwards()
  const { data: profile } = useProfile()
  const { data: metrics } = useBodyMetrics()

  const last = metrics?.length ? metrics[metrics.length - 1] : null
  const [form, setForm] = useState({
    weight_kg: last?.weight_kg ?? profile?.start_weight_kg ?? 70,
    waist_cm: last?.waist_cm ?? 80,
    arm_cm: last?.arm_cm ?? 32,
  })

  if (!profile) return <div className="page"><Spinner /></div>

  const baseline = metrics?.[0]

  async function save() {
    await db.upsertBodyMetric(user.id, {
      date: todayStr(),
      weight_kg: Number(form.weight_kg), waist_cm: Number(form.waist_cm), arm_cm: Number(form.arm_cm),
    })
    qc.invalidateQueries({ queryKey: qk.body(user.id) })
    await award('body_metrics', XP.body_metrics, 'Métricas registradas', { oncePerDay: true })
    if (baseline) {
      if (Number(form.arm_cm) - Number(baseline.arm_cm) >= 1) await grantBadge('arm_plus_1')
      if (Number(baseline.waist_cm) - Number(form.waist_cm) >= 2) await grantBadge('waist_minus_2')
    }
  }

  const chartData = (metrics || []).map((m) => ({
    date: m.date.slice(5),
    Peso: m.weight_kg ? Number(m.weight_kg) : null,
    Cintura: m.waist_cm ? Number(m.waist_cm) : null,
    Brazo: m.arm_cm ? Number(m.arm_cm) : null,
  }))

  const delta = (key) => (baseline && last ? (Number(last[key]) - Number(baseline[key])) : 0)

  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">Métricas · semanal</p><h1>Tu cuerpo</h1></div>

      {baseline && last && (
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 14 }}>
          <GoalCard icon={Scale} label="Peso" value={last.weight_kg} unit="kg" delta={delta('weight_kg')} good="down" />
          <GoalCard icon={TrendingDown} label="Cintura" value={last.waist_cm} unit="cm" delta={delta('waist_cm')} good="down" target="-2 cm" />
          <GoalCard icon={TrendingUp} label="Brazo" value={last.arm_cm} unit="cm" delta={delta('arm_cm')} good="up" target="+1 cm" />
        </div>
      )}

      <Card title="Registrar medición de hoy">
        <div className="field">
          <label>Peso (kg)</label>
          <Stepper value={form.weight_kg} step={0.1} decimals={1} min={30} max={200} onChange={(v) => setForm({ ...form, weight_kg: v })} />
        </div>
        <div className="field">
          <label>Cintura (cm)</label>
          <Stepper value={form.waist_cm} step={0.5} decimals={1} min={40} max={160} onChange={(v) => setForm({ ...form, waist_cm: v })} />
        </div>
        <div className="field">
          <label>Brazo (cm)</label>
          <Stepper value={form.arm_cm} step={0.5} decimals={1} min={20} max={60} onChange={(v) => setForm({ ...form, arm_cm: v })} />
        </div>
        <button className="btn btn-primary btn-block btn-lg" onClick={save}><Check size={18} /> Guardar</button>
      </Card>

      <Card title="Tendencia">
        {chartData.length > 1 ? (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <XAxis dataKey="date" stroke="var(--text-faint)" fontSize={11} />
                <YAxis stroke="var(--text-faint)" fontSize={11} />
                <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10 }} />
                <Line type="monotone" dataKey="Peso" stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="Cintura" stroke="var(--info)" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="Brazo" stroke="var(--success)" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <Empty icon="📈" title="Sin datos aún">Registrá al menos dos mediciones para ver la tendencia.</Empty>}
      </Card>

      <p className="faint center mt-16" style={{ fontSize: '0.8rem' }}>La balanza sola engaña en recomposición. Mirá fotos, medidas y fuerza.</p>
    </div>
  )
}

function GoalCard({ icon: Icon, label, value, unit, delta, good, target }) {
  const positive = good === 'up' ? delta > 0 : delta < 0
  const color = delta === 0 ? 'var(--text-muted)' : positive ? 'var(--success)' : 'var(--danger)'
  return (
    <Card style={{ padding: 12 }}>
      <Icon size={16} color="var(--text-faint)" />
      <div className="num mt-8" style={{ fontSize: '1.2rem', fontWeight: 800 }}>{value ?? '–'}<span className="faint" style={{ fontSize: '0.7rem' }}> {unit}</span></div>
      <div className="faint" style={{ fontSize: '0.74rem', fontWeight: 600 }}>{label}</div>
      {delta !== 0 && <div style={{ fontSize: '0.74rem', color, fontWeight: 700 }}>{delta > 0 ? '+' : ''}{delta.toFixed(1)} {unit}</div>}
      {target && <div className="faint" style={{ fontSize: '0.68rem' }}>meta {target}</div>}
    </Card>
  )
}
