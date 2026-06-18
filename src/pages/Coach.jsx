import { useState } from 'react'
import { Sparkles, AlertCircle } from 'lucide-react'
import { supabase, COACH_FUNCTION } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useProfile } from '../data/hooks'
import { useAwards } from '../data/awards'
import * as db from '../data/db'
import { muscleMemoryState } from '../lib/gamification'
import { todayStr } from '../lib/dates'
import { Card, Spinner } from '../components/ui'

const MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6 (recomendado)' },
  { id: 'claude-opus-4-8', label: 'Opus 4.8 (más profundo)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (rápido)' },
]
const MODEL_KEY = 'forge.coach.model'

export default function Coach() {
  const { user } = useAuth()
  const { data: profile } = useProfile()
  const { grantBadge } = useAwards()
  const [question, setQuestion] = useState('')
  const [model, setModel] = useState(localStorage.getItem(MODEL_KEY) || MODELS[0].id)
  const [loading, setLoading] = useState(false)
  const [answer, setAnswer] = useState(null)
  const [error, setError] = useState(null)

  async function buildPayload() {
    const [sessions, metrics, sleep, cardio, streaks, foodsToday] = await Promise.all([
      db.listSessions(user.id, 8),
      db.listBodyMetrics(user.id),
      db.listSleep(user.id, 7),
      db.listCardio(user.id, 10),
      db.getStreaks(user.id),
      db.getNutritionByDate(user.id, todayStr()),
    ])
    const completed = sessions.filter((s) => s.status === 'completed').slice(0, 4)
    const sessionDetails = []
    for (const s of completed) {
      const sets = await db.getSessionSets(s.id)
      sessionDetails.push({
        date: s.date, title: s.title, volume: s.total_volume_kg,
        sets: sets.filter((x) => x.done && !x.is_warmup).map((x) => ({ ex: x.exercise_id, w: x.weight_kg, reps: x.reps })),
      })
    }
    const mm = muscleMemoryState(profile.muscle_memory_start, profile.muscle_memory_days, todayStr())
    return {
      perfil: {
        objetivo: profile.goal, meta_proteina_g: profile.protein_goal_g,
        meta_pasos: profile.step_goal, meta_sueno_h: profile.sleep_goal_hours,
        dias_entreno: profile.training_weekdays, muscle_memory_dias_restantes: mm.daysLeft,
      },
      sesiones_recientes: sessionDetails,
      metricas: metrics.slice(-5),
      sueno: sleep,
      cardio,
      rachas: streaks.map((s) => ({ tipo: s.kind, actual: s.current_count, mejor: s.longest_count })),
      proteina_hoy_g: foodsToday.reduce((a, n) => a + Number(n.protein_g) * Number(n.qty || 1), 0),
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
      await grantBadge('first_coach')
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
