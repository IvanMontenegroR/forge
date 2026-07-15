import { useState } from 'react'
import { Sparkles, AlertCircle } from 'lucide-react'
import { supabase, COACH_FUNCTION } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../data/hooks'
import * as db from '../data/db'
import { todayStr, addDays } from '../lib/dates'
import { Card, Spinner } from '../components/ui'

const MODELS = [
  { id: 'claude-sonnet-5', label: 'Sonnet 5 (recomendado)' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8 (más profundo)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (rápido)' },
]
const MODEL_KEY = 'forge.coach.model'

export default function Coach() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const [question, setQuestion] = useState('')
  const [model, setModel] = useState(localStorage.getItem(MODEL_KEY) || MODELS[0].id)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState(null)
  const [error, setError] = useState(null)

  async function buildPayload() {
    const today = todayStr()
    const nutFrom = addDays(today, -29) // últimos 30 días de nutrición
    const [sessions, metrics, sleep, cardio, nutRows, exercises] = await Promise.all([
      db.listSessions(user.id, 20),
      db.listBodyMetrics(user.id),
      db.listSleep(user.id, 14),
      db.listCardio(user.id, 20),
      db.getNutritionRange(user.id, nutFrom, today),
      db.listExercises(),
    ])
    const exName = new Map(exercises.map((e) => [e.id, e.name]))
    const completed = sessions.filter((s) => s.status === 'completed')
    const sessionDetails = []
    for (const s of completed.slice(0, 6)) {
      const sets = await db.getSessionSets(s.id)
      // Agrupar por ejercicio (con nombre, no el UUID) para que el coach lo lea claro.
      const porEjercicio = new Map()
      for (const x of sets.filter((v) => v.done && !v.is_warmup)) {
        const nombre = exName.get(x.exercise_id) || 'Ejercicio'
        if (!porEjercicio.has(nombre)) porEjercicio.set(nombre, [])
        porEjercicio.get(nombre).push({ w: Number(x.weight_kg), reps: x.reps })
      }
      sessionDetails.push({
        date: s.date, title: s.title, volume: s.total_volume_kg,
        ejercicios: [...porEjercicio.entries()].map(([ejercicio, series]) => ({ ejercicio, series })),
      })
    }

    // Nutrición: agregar por día (kcal y proteína)
    const byDay = new Map()
    for (const n of nutRows) {
      const q = Number(n.qty || 1)
      const cur = byDay.get(n.date) || { kcal: 0, prot: 0 }
      cur.kcal += Number(n.kcal || 0) * q
      cur.prot += Number(n.protein_g || 0) * q
      byDay.set(n.date, cur)
    }
    const nutricion_diaria = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([fecha, v]) => ({ fecha, kcal: Math.round(v.kcal), proteina_g: Math.round(v.prot) }))
    const kcalGoal = profile.target_kcal || 2050
    const proteinGoal = profile.protein_goal_g || 145
    const dias = nutricion_diaria.length
    const resumen_nutricion = dias ? {
      dias_registrados: dias,
      promedio_kcal: Math.round(nutricion_diaria.reduce((a, d) => a + d.kcal, 0) / dias),
      promedio_proteina_g: Math.round(nutricion_diaria.reduce((a, d) => a + d.proteina_g, 0) / dias),
      dias_bajo_techo_kcal: nutricion_diaria.filter((d) => d.kcal <= kcalGoal).length,
      dias_proteina_cumplida: nutricion_diaria.filter((d) => d.proteina_g >= proteinGoal).length,
    } : null

    return {
      hoy: today,
      perfil: {
        objetivo: profile.goal, edad: profile.age, altura_cm: profile.height_cm,
        peso_inicial_kg: profile.start_weight_kg,
        meta_proteina_g: proteinGoal, meta_kcal: kcalGoal, meta_pasos: profile.step_goal,
        meta_sueno_h: profile.sleep_goal_hours, dias_entreno: profile.training_weekdays,
      },
      entrenamiento: {
        sesiones_completadas_total: completed.length,
        ultima_sesion: completed[0]?.date || null,
        sesiones_recientes: sessionDetails,
      },
      nutricion: {
        resumen: resumen_nutricion,
        por_dia: nutricion_diaria, // últimos 30 días
      },
      metricas: metrics.slice(-8),
      sueno: sleep,
      cardio,
    }
  }

  async function analyze() {
    setLoading(true); setError(null); setAnswer(null)
    try {
      const payload = await buildPayload()
      const { data, error } = await supabase.functions.invoke(COACH_FUNCTION, {
        body: { payload, question, model },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setAnswer(data.text)
    } catch (e) {
      setError(e.message || 'No se pudo contactar al coach.')
    } finally {
      setLoading(false)
    }
  }

  function pickModel(m) {
    setModel(m); localStorage.setItem(MODEL_KEY, m)
  }

  if (!profile) return <div className="page"><Spinner /></div>

  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">Coach IA</p><h1>Análisis con Claude</h1></div>

      <Card>
        <p className="muted" style={{ fontSize: '0.9rem' }}>
          Le mando tus datos recientes (sesiones, métricas, sueño, cardio, rachas) y te devuelve
          análisis y ajustes: cuándo subir peso, adherencia y descanso.
        </p>
        <div className="field mt-16">
          <label htmlFor="q">¿Algo puntual? (opcional)</label>
          <textarea id="q" className="input" rows={3} placeholder="Ej: ¿estoy progresando bien en press de banca? ¿debería subir peso?"
            value={question} onChange={(e) => setQuestion(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="model">Modelo</label>
          <select id="model" className="select input" value={model} onChange={(e) => pickModel(e.target.value)}>
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        <button className="btn btn-primary btn-block btn-lg" onClick={analyze} disabled={loading}>
          {loading ? 'Pensando…' : <><Sparkles size={18} /> Analizar mi progreso</>}
        </button>
      </Card>

      {loading && <Card><Spinner label="El coach está revisando tus datos…" /></Card>}

      {error && (
        <Card style={{ borderColor: 'var(--danger)' }}>
          <div className="row gap-8" style={{ color: 'var(--danger)' }}><AlertCircle size={18} /><strong>Error</strong></div>
          <p className="muted mt-8" style={{ fontSize: '0.86rem' }}>{error}</p>
          <p className="faint mt-8" style={{ fontSize: '0.78rem' }}>
            Verificá que la Edge Function <code>{COACH_FUNCTION}</code> esté desplegada y que tenga
            configurado el secreto <code>ANTHROPIC_API_KEY</code>. (Ver README.)
          </p>
        </Card>
      )}

      {answer && (
        <Card title="Análisis del coach">
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: '0.94rem' }}>{answer}</div>
        </Card>
      )}
    </div>
  )
}
