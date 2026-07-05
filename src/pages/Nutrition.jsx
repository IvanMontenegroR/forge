import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, X, Beef, Check, Camera, Flame, Sparkles, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile, useUserFoods, useNutritionToday, qk } from '../data/hooks'
import { supabase, MEAL_FUNCTION } from '../lib/supabase'
import * as db from '../data/db'
import { todayStr, weekStart } from '../lib/dates'
import { Card, Ring, Spinner } from '../components/ui'

const MEAL_MODELS = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8 (más preciso)' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5 (rápido)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (económico)' },
]
const MEAL_MODEL_KEY = 'forge.meal.model'

// Redimensiona la imagen a un máximo razonable y devuelve { base64, media_type }
// para que el payload de la Edge Function quede liviano y confiable.
function fileToResizedBase64(file, maxSide = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = () => { img.src = reader.result }
    reader.onerror = reject
    img.onerror = reject
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w; canvas.height = h
      canvas.getContext('2d').drawImage(img, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      resolve({ base64: dataUrl.split(',')[1], media_type: 'image/jpeg' })
    }
    reader.readAsDataURL(file)
  })
}

export default function Nutrition() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: profile } = useProfile()
  const { data: foods } = useUserFoods()
  const { data: logs } = useNutritionToday()
  const [custom, setCustom] = useState({ name: '', protein_g: '', kcal: '', qty: 1 })
  const [showCustom, setShowCustom] = useState(false)
  const fileRef = useRef(null)
  const modeRef = useRef('review')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoErr, setPhotoErr] = useState(null)
  const [review, setReview] = useState(null) // { items:[{name,kcal,protein_g}] }
  const [photoModel, setPhotoModel] = useState(localStorage.getItem(MEAL_MODEL_KEY) || MEAL_MODELS[0].id)

  if (!profile) return <div className="page"><Spinner /></div>

  const goal = profile.protein_goal_g || 145
  const total = (logs || []).reduce((s, n) => s + Number(n.protein_g) * Number(n.qty || 1), 0)
  const pct = Math.min(1, total / goal)
  const reached = total >= goal

  const kcalGoal = profile.target_kcal || 2050
  const kcalTotal = (logs || []).reduce((s, n) => s + Number(n.kcal || 0) * Number(n.qty || 1), 0)
  const kcalPct = Math.min(1, kcalTotal / kcalGoal)
  const kcalOver = kcalTotal > kcalGoal

  function invalidate() {
    qc.invalidateQueries({ queryKey: qk.nutrition(user.id, todayStr()) })
    qc.invalidateQueries({ queryKey: qk.nutritionWeek(user.id, weekStart()) })
  }

  async function add(food, qty = 1) {
    await db.addNutrition(user.id, {
      food_id: food.id || null, name: food.name,
      protein_g: Number(food.protein_g) || 0, kcal: food.kcal ? Number(food.kcal) : null, qty,
    })
    invalidate()
  }

  async function addCustom() {
    if (!custom.name) return
    await add(
      { name: custom.name, protein_g: custom.protein_g || 0, kcal: custom.kcal || null },
      Number(custom.qty) || 1,
    )
    setCustom({ name: '', protein_g: '', kcal: '', qty: 1 })
    setShowCustom(false)
  }

  async function remove(id) {
    await db.deleteNutrition(id)
    invalidate()
  }

  function pickPhoto(mode) {
    modeRef.current = mode
    setPhotoErr(null)
    fileRef.current?.click()
  }

  async function onPhoto(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = '' // permite re-elegir las mismas fotos
    if (!files.length) return
    setPhotoBusy(true); setPhotoErr(null)
    const allItems = []
    const notes = []
    let failed = 0
    try {
      for (const file of files) {
        try {
          const { base64, media_type } = await fileToResizedBase64(file)
          const { data, error } = await supabase.functions.invoke(MEAL_FUNCTION, {
            body: { image: base64, media_type, model: photoModel },
          })
          if (error) throw error
          if (data?.error) throw new Error(data.error)
          const items = (data.items || []).map((it) => ({
            name: it.name || 'Comida',
            kcal: Math.round(Number(it.kcal) || 0),
            protein_g: Math.round(Number(it.protein_g) || 0),
          }))
          allItems.push(...items)
          if (data.note) notes.push(data.note)
        } catch { failed++ }
      }
      if (!allItems.length) throw new Error('No pude identificar comida en las fotos. Probá con otras tomas.')
      if (modeRef.current === 'save') {
        for (const it of allItems) await add(it)
      } else {
        setReview({ items: allItems, note: notes.join(' · ') })
      }
      if (failed) setPhotoErr(`${failed} de ${files.length} foto(s) no se pudieron analizar; el resto sí.`)
    } catch (err) {
      setPhotoErr(err.message || 'No se pudo analizar la foto.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function saveReview() {
    for (const it of review.items) {
      if (!it.name) continue
      await add({ name: it.name, protein_g: Number(it.protein_g) || 0, kcal: Number(it.kcal) || null })
    }
    setReview(null)
  }

  function editItem(i, patch) {
    setReview((r) => ({ ...r, items: r.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }))
  }
  function removeItem(i) {
    setReview((r) => ({ ...r, items: r.items.filter((_, idx) => idx !== i) }))
  }

  const reviewKcal = review?.items.reduce((s, it) => s + (Number(it.kcal) || 0), 0) || 0
  const reviewProt = review?.items.reduce((s, it) => s + (Number(it.protein_g) || 0), 0) || 0

  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">Nutrición</p><h1>Hoy</h1></div>

      <Card>
        <div className="row gap-16">
          <Ring progress={pct} size={88} stroke={9} color={reached ? 'var(--success)' : 'var(--danger)'}>
            <span style={{ fontSize: 17 }}>{Math.round(pct * 100)}%</span>
          </Ring>
          <div className="col grow" style={{ gap: 4 }}>
            <span className="faint" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Proteína</span>
            <div className="num" style={{ fontSize: '2rem', fontWeight: 800 }}>{Math.round(total)}<span className="faint" style={{ fontSize: '1rem' }}> / {goal} g</span></div>
            {reached
              ? <span className="pill success"><Check size={14} /> Meta cumplida</span>
              : <span className="muted" style={{ fontSize: '0.86rem' }}>Faltan {Math.max(0, Math.round(goal - total))} g · cerralos con whey</span>}
          </div>
        </div>
      </Card>

      <Card>
        <div className="row gap-16">
          <Ring progress={kcalPct} size={88} stroke={9} color={kcalOver ? 'var(--warn)' : 'var(--info)'}>
            <Flame size={26} />
          </Ring>
          <div className="col grow" style={{ gap: 4 }}>
            <span className="faint" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Calorías</span>
            <div className="num" style={{ fontSize: '2rem', fontWeight: 800 }}>{Math.round(kcalTotal)}<span className="faint" style={{ fontSize: '1rem' }}> / {kcalGoal} kcal</span></div>
            {kcalOver
              ? <span className="pill warn" style={{ width: 'fit-content' }}>Pasaste por {Math.round(kcalTotal - kcalGoal)} kcal</span>
              : <span className="muted" style={{ fontSize: '0.86rem' }}>Quedan {Math.max(0, Math.round(kcalGoal - kcalTotal))} kcal</span>}
          </div>
        </div>
      </Card>

      <Card title="Foto del plato">
        <p className="muted" style={{ fontSize: '0.86rem' }}>
          Sacá o subí una o varias fotos y Claude estima calorías y proteína de cada una.
        </p>
        <div className="row gap-8 mt-12">
          <button className="btn btn-primary grow" onClick={() => pickPhoto('review')} disabled={photoBusy}>
            <Sparkles size={16} /> Analizar y revisar
          </button>
          <button className="btn btn-ghost grow" onClick={() => pickPhoto('save')} disabled={photoBusy}>
            <Camera size={16} /> Analizar y guardar
          </button>
        </div>
        <div className="field mt-12" style={{ marginBottom: 0 }}>
          <label htmlFor="meal-model" style={{ fontSize: '0.78rem' }}>Modelo de análisis</label>
          <select id="meal-model" className="select input" value={photoModel}
            onChange={(e) => { setPhotoModel(e.target.value); localStorage.setItem(MEAL_MODEL_KEY, e.target.value) }}>
            {MEAL_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPhoto} style={{ display: 'none' }} />
        {photoBusy && <div className="mt-12"><Spinner label="Analizando las fotos…" /></div>}
        {photoErr && (
          <div className="pill" style={{ color: 'var(--danger)', background: 'var(--danger-soft)', width: '100%', justifyContent: 'flex-start', marginTop: 12 }}>
            <AlertCircle size={14} /> {photoErr}
          </div>
        )}
      </Card>

      {review && (
        <Card title="Revisar estimación" action={<button className="btn btn-ghost btn-icon btn-sm" onClick={() => setReview(null)} aria-label="cerrar"><X size={16} /></button>}>
          <p className="faint" style={{ fontSize: '0.78rem', marginBottom: 10 }}>Estimación aproximada — ajustá lo que haga falta antes de guardar.</p>
          <div className="col">
            {review.items.map((it, i) => (
              <div key={i} className="row gap-8" style={{ alignItems: 'center' }}>
                <input className="input grow" value={it.name} onChange={(e) => editItem(i, { name: e.target.value })} />
                <input className="input num" style={{ width: 76 }} inputMode="numeric" value={it.kcal} onChange={(e) => editItem(i, { kcal: e.target.value })} title="kcal" />
                <input className="input num" style={{ width: 56 }} inputMode="numeric" value={it.protein_g} onChange={(e) => editItem(i, { protein_g: e.target.value })} title="g proteína" />
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeItem(i)} aria-label="quitar"><X size={15} /></button>
              </div>
            ))}
          </div>
          <div className="faint num mt-12" style={{ fontSize: '0.82rem' }}>Total: {Math.round(reviewKcal)} kcal · {Math.round(reviewProt)} g proteína</div>
          <button className="btn btn-primary btn-block btn-lg mt-12" onClick={saveReview} disabled={!review.items.length}>
            <Check size={18} /> Guardar {review.items.length} {review.items.length === 1 ? 'item' : 'items'}
          </button>
        </Card>
      )}

      <Card title="Quick-add">
        <div className="row wrap gap-8">
          {(foods || []).map((f) => (
            <button key={f.id} className="chip" onClick={() => add(f)} title={f.serving || ''}>
              <Beef size={14} /> {f.name}
              <span className="faint num">
                {Number(f.protein_g) > 0 ? `+${f.protein_g}g` : ''}{Number(f.protein_g) > 0 && f.kcal ? ' · ' : ''}{f.kcal ? `${f.kcal} kcal` : ''}
              </span>
            </button>
          ))}
          <button className="chip" onClick={() => setShowCustom((v) => !v)}><Plus size={14} /> Otro</button>
        </div>
        {showCustom && (
          <div className="row gap-8 mt-12">
            <input className="input grow" placeholder="Nombre" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} />
            <input className="input num" style={{ width: 78 }} placeholder="g prot" inputMode="decimal" value={custom.protein_g} onChange={(e) => setCustom({ ...custom, protein_g: e.target.value })} />
            <input className="input num" style={{ width: 78 }} placeholder="kcal" inputMode="numeric" value={custom.kcal} onChange={(e) => setCustom({ ...custom, kcal: e.target.value })} />
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
                  <span className="faint num" style={{ display: 'block', fontSize: '0.8rem' }}>
                    {Math.round(l.protein_g * l.qty)} g proteína{l.kcal ? ` · ${Math.round(l.kcal * l.qty)} kcal` : ''}
                  </span>
                </div>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(l.id)} aria-label="quitar"><X size={16} /></button>
              </div>
            ))}
          </div>
        ) : <p className="faint center" style={{ padding: '12px 0' }}>Nada registrado todavía.</p>}
      </Card>

      <p className="faint center mt-16" style={{ fontSize: '0.8rem' }}>
        Protein-first. Objetivo ~{kcalGoal} kcal · meta {goal} g de proteína. Las estimaciones por foto son aproximadas.
      </p>
    </div>
  )
}
