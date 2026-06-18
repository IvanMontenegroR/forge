import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut, Save, Plus, Trash2, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile, usePrograms, useUserFoods, useSupplements, qk } from '../data/hooks'
import { supabase } from '../lib/supabase'
import * as db from '../data/db'
import { WEEKDAY_NAMES } from '../lib/dates'
import { Card, Spinner } from '../components/ui'

export default function Profile() {
  const { user, signOut } = useAuth()
  const qc = useQueryClient()
  const { data: profile } = useProfile()
  const { data: programs } = usePrograms()
  const { data: foods } = useUserFoods()
  const { data: supps } = useSupplements()

  const [form, setForm] = useState(null)
  const [saved, setSaved] = useState(false)

  if (!profile) return <div className="page"><Spinner /></div>
  const f = form || profile
  const set = (patch) => setForm({ ...f, ...patch })
  const toggleDay = (d) => {
    const days = f.training_weekdays || []
    set({ training_weekdays: days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort((a, b) => a - b) })
  }

  async function save() {
    await db.updateProfile(user.id, {
      full_name: f.full_name, goal: f.goal,
      protein_goal_g: Number(f.protein_goal_g), step_goal: Number(f.step_goal),
      hiit_per_week: Number(f.hiit_per_week), sleep_goal_hours: Number(f.sleep_goal_hours),
      caffeine_cutoff_hour: Number(f.caffeine_cutoff_hour), training_weekdays: f.training_weekdays,
      active_program_id: f.active_program_id, photo_reminder_days: Number(f.photo_reminder_days),
      maintenance_kcal: Number(f.maintenance_kcal) || null, target_kcal: Number(f.target_kcal) || null,
    })
    qc.invalidateQueries({ queryKey: qk.profile(user.id) })
    setSaved(true); setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">Perfil</p><h1>Configuración</h1></div>

      <Card title="Datos">
        <div className="field">
          <label>Nombre</label>
          <input className="input" value={f.full_name || ''} onChange={(e) => set({ full_name: e.target.value })} />
        </div>
        <div className="field">
          <label>Objetivo</label>
          <select className="select input" value={f.goal || 'recomp'} onChange={(e) => set({ goal: e.target.value })}>
            <option value="recomp">Recomposición</option>
            <option value="cut">Bajar grasa</option>
            <option value="bulk">Ganar músculo</option>
          </select>
        </div>
        <div className="field">
          <label>Programa activo</label>
          <select className="select input" value={f.active_program_id || ''} onChange={(e) => set({ active_program_id: e.target.value })}>
            {programs?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Días de entreno</label>
          <div className="row wrap gap-8">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <button key={d} className="chip" aria-pressed={f.training_weekdays?.includes(d)} onClick={() => toggleDay(d)}>{WEEKDAY_NAMES[d]}</button>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Metas">
        <NumField label="Proteína diaria (g)" value={f.protein_goal_g} onChange={(v) => set({ protein_goal_g: v })} />
        <NumField label="Pasos diarios" value={f.step_goal} onChange={(v) => set({ step_goal: v })} />
        <NumField label="HIIT por semana" value={f.hiit_per_week} onChange={(v) => set({ hiit_per_week: v })} />
        <NumField label="Horas de sueño" value={f.sleep_goal_hours} onChange={(v) => set({ sleep_goal_hours: v })} step="0.5" />
        <NumField label="Cafeína hasta (hora)" value={f.caffeine_cutoff_hour} onChange={(v) => set({ caffeine_cutoff_hour: v })} />
        <NumField label="Recordatorio de fotos (días)" value={f.photo_reminder_days} onChange={(v) => set({ photo_reminder_days: v })} />
        <div className="row gap-8">
          <div className="grow"><NumField label="Mantenimiento (kcal)" value={f.maintenance_kcal} onChange={(v) => set({ maintenance_kcal: v })} /></div>
          <div className="grow"><NumField label="Objetivo (kcal)" value={f.target_kcal} onChange={(v) => set({ target_kcal: v })} /></div>
        </div>
      </Card>

      <button className="btn btn-primary btn-block btn-lg" onClick={save}>
        {saved ? <><Check size={18} /> Guardado</> : <><Save size={18} /> Guardar cambios</>}
      </button>

      <FoodEditor foods={foods} userId={user.id} qc={qc} />
      <SupplementEditor supps={supps} userId={user.id} qc={qc} />

      <Card title="Cuenta">
        <p className="muted" style={{ fontSize: '0.86rem' }}>{user.email}</p>
        <button className="btn btn-ghost btn-block mt-12" onClick={signOut} style={{ color: 'var(--danger)' }}>
          <LogOut size={18} /> Cerrar sesión
        </button>
      </Card>
    </div>
  )
}

function NumField({ label, value, onChange, step }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input num" type="number" step={step || '1'} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function FoodEditor({ foods, userId, qc }) {
  const [n, setN] = useState({ name: '', protein_g: '', kcal: '', serving: '' })
  async function add() {
    if (!n.name) return
    await supabase.from('user_foods').insert({
      user_id: userId, name: n.name,
      protein_g: Number(n.protein_g) || 0, kcal: n.kcal ? Number(n.kcal) : null,
      serving: n.serving, sort_order: (foods?.length || 0),
    })
    setN({ name: '', protein_g: '', kcal: '', serving: '' })
    qc.invalidateQueries({ queryKey: qk.foods(userId) })
  }
  async function del(id) {
    await supabase.from('user_foods').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: qk.foods(userId) })
  }
  return (
    <Card title="Comidas del quick-add">
      <div className="col">
        {(foods || []).map((food) => (
          <div key={food.id} className="list-row">
            <span className="grow"><strong style={{ fontSize: '0.9rem' }}>{food.name}</strong> <span className="faint num">{food.protein_g}g{food.kcal ? ` · ${food.kcal} kcal` : ''}{food.serving ? ` · ${food.serving}` : ''}</span></span>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => del(food.id)} aria-label="borrar"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <div className="row gap-8 mt-12">
        <input className="input grow" placeholder="Comida" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <input className="input num" style={{ width: 74 }} placeholder="g prot" value={n.protein_g} onChange={(e) => setN({ ...n, protein_g: e.target.value })} />
        <input className="input num" style={{ width: 74 }} placeholder="kcal" value={n.kcal} onChange={(e) => setN({ ...n, kcal: e.target.value })} />
        <button className="btn btn-primary btn-icon" onClick={add}><Plus size={18} /></button>
      </div>
    </Card>
  )
}

function SupplementEditor({ supps, userId, qc }) {
  const [n, setN] = useState({ name: '', dose: '', timing: '' })
  async function add() {
    if (!n.name) return
    await supabase.from('user_supplements').insert({ user_id: userId, name: n.name, dose: n.dose, timing: n.timing, active: true, sort_order: (supps?.length || 0) })
    setN({ name: '', dose: '', timing: '' })
    qc.invalidateQueries({ queryKey: qk.supplements(userId) })
  }
  async function del(id) {
    await supabase.from('user_supplements').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: qk.supplements(userId) })
  }
  return (
    <Card title="Suplementos">
      <div className="col">
        {(supps || []).map((s) => (
          <div key={s.id} className="list-row">
            <span className="grow"><strong style={{ fontSize: '0.9rem' }}>{s.name}</strong> <span className="faint">{s.dose} · {s.timing}{s.active ? '' : ' · off'}</span></span>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => del(s.id)} aria-label="borrar"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
      <div className="row gap-8 mt-12">
        <input className="input" placeholder="Suplemento" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} />
        <input className="input" style={{ width: 90 }} placeholder="Dosis" value={n.dose} onChange={(e) => setN({ ...n, dose: e.target.value })} />
        <button className="btn btn-primary btn-icon" onClick={add}><Plus size={18} /></button>
      </div>
    </Card>
  )
}
