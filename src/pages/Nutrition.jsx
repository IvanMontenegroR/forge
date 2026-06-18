import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, X, Beef, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile, useUserFoods, useNutritionToday, qk } from '../data/hooks'
import { useAwards } from '../data/awards'
import * as db from '../data/db'
import { todayStr } from '../lib/dates'
import { XP } from '../lib/gamification'
import { Card, Ring, Spinner } from '../components/ui'

export default function Nutrition() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { award, bumpQuest, grantBadge } = useAwards()
  const { data: profile } = useProfile()
  const { data: foods } = useUserFoods()
  const { data: logs } = useNutritionToday()
  const [custom, setCustom] = useState({ name: '', protein_g: '', qty: 1 })
  const [showCustom, setShowCustom] = useState(false)

  if (!profile) return <div className="page"><Spinner /></div>

  const goal = profile.protein_goal_g || 145
  const total = (logs || []).reduce((s, n) => s + Number(n.protein_g) * Number(n.qty || 1), 0)
  const pct = Math.min(1, total / goal)
  const reached = total >= goal

  async function add(food, qty = 1) {
    await db.addNutrition(user.id, {
      food_id: food.id || null, name: food.name,
      protein_g: Number(food.protein_g) || 0, kcal: food.kcal ? Number(food.kcal) : null, qty,
    })
    qc.invalidateQueries({ queryKey: qk.nutrition(user.id, todayStr()) })
    // ¿se cruzó la meta con este registro?
    const after = total + (Number(food.protein_g) || 0) * qty
    if (after >= goal && !reached) {
      await award('protein_goal', XP.protein_goal, 'Meta de proteína cumplida', { oncePerDay: true })
      await bumpQuest('protein', 1)
      const st = await db.bumpDailyStreak(user.id, 'protein')
      qc.invalidateQueries({ queryKey: qk.streaks(user.id) })
      if (st?.current_count >= 7) await grantBadge('protein_week')
    }
  }

  async function addCustom() {
    if (!custom.name) return
    await add({ name: custom.name, protein_g: custom.protein_g || 0 }, Number(custom.qty) || 1)
    setCustom({ name: '', protein_g: '', qty: 1 })
    setShowCustom(false)
  }

  async function remove(id) {
    await db.deleteNutrition(id)
    qc.invalidateQueries({ queryKey: qk.nutrition(user.id, todayStr()) })
  }

  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">Nutrición</p><h1>Proteína de hoy</h1></div>

      <Card>
        <div className="row gap-16">
          <Ring progress={pct} size={88} stroke={9} color={reached ? 'var(--success)' : 'var(--danger)'}>
            <span style={{ fontSize: 17 }}>{Math.round(pct * 100)}%</span>
          </Ring>
          <div className="col grow" style={{ gap: 4 }}>
            <div className="num" style={{ fontSize: '2rem', fontWeight: 800 }}>{Math.round(total)}<span className="faint" style={{ fontSize: '1rem' }}> / {goal} g</span></div>
            {reached
              ? <span className="pill success"><Check size={14} /> Meta cumplida</span>
              : <span className="muted" style={{ fontSize: '0.86rem' }}>Faltan {Math.max(0, Math.round(goal - total))} g · cerralos con whey</span>}
          </div>
        </div>
      </Card>

      <Card title="Quick-add">
        <div className="row wrap gap-8">
          {(foods || []).map((f) => (
            <button key={f.id} className="chip" onClick={() => add(f)} title={`${f.protein_g} g proteína · ${f.serving || ''}`}>
              <Beef size={14} /> {f.name} <span className="faint num">+{f.protein_g}g</span>
            </button>
          ))}
          <button className="chip" onClick={() => setShowCustom((v) => !v)}><Plus size={14} /> Otro</button>
        </div>
        {showCustom && (
          <div className="row gap-8 mt-12">
            <input className="input" placeholder="Nombre" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
            <input className="input num" style={{ width: 90 }} placeholder="g prot" inputMode="decimal" value={custom.protein_g} onChange={(e) => setCustom({ ...custom, protein_g: e.target.value })} />
            <button className="btn btn-primary btn-icon" onClick={addCustom}><Check size={18} /></button>
          </div>
        )}
      </Card>

      <Card title={`Hoy (${logs?.length || 0})`}>
        {logs?.length ? (
          <div className="col">
            {logs.map((l) => (
              <div key={l.id} className="list-row">
                <div className="grow">
                  <strong style={{ fontSize: '0.95rem' }}>{l.name}{l.qty > 1 ? ` ×${l.qty}` : ''}</strong>
                  <span className="faint num" style={{ display: 'block', fontSize: '0.8rem' }}>{Math.round(l.protein_g * l.qty)} g proteína{l.kcal ? ` · ${Math.round(l.kcal * l.qty)} kcal` : ''}</span>
                </div>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(l.id)} aria-label="quitar"><X size={16} /></button>
              </div>
            ))}
          </div>
        ) : <p className="faint center" style={{ padding: '12px 0' }}>Nada registrado todavía.</p>}
      </Card>

      <p className="faint center mt-16" style={{ fontSize: '0.8rem' }}>
        Protein-first: no contamos calorías estricto. Referencia: ~{profile.target_kcal || 2050} kcal objetivo.
      </p>
    </div>
  )
}
