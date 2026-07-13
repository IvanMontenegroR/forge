import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Footprints, Check, Zap, Smartphone, Copy, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile, useCardio, useStepsToday, qk } from '../data/hooks'
import * as db from '../data/db'
import { todayStr, prettyDate } from '../lib/dates'
import { Card, ProgressBar, Stepper, Spinner } from '../components/ui'

const STEPS_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-steps`

export default function Cardio() {
  const { user } = useAuth()
  const qc = useQueryClient()
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
  }

  async function addHiit() {
    await db.addCardio(user.id, { date: todayStr(), type: 'hiit', duration_min: Number(hiit.duration_min) || 15 })
    qc.invalidateQueries({ queryKey: qk.cardio(user.id) })
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

      <StepsSync token={profile.steps_token} />

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

function StepsSync({ token }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(null)
  function copy(text, which) {
    navigator.clipboard?.writeText(text)
    setCopied(which); setTimeout(() => setCopied(null), 1500)
  }
  return (
    <Card title="Pasos del iPhone (automático)">
      <div className="row gap-12">
        <span className="lead" style={{ width: 40, height: 40, background: 'var(--info-soft)', color: 'var(--info)' }}><Smartphone size={20} /></span>
        <div className="grow">
          <strong>Sincronizar con Apple Salud</strong>
          <p className="muted" style={{ fontSize: '0.82rem' }}>Un Atajo de iPhone manda tus pasos solo, cada día.</p>
        </div>
      </div>

      <div className="col gap-8 mt-12">
        <div className="col gap-4">
          <span className="faint" style={{ fontSize: '0.74rem', fontWeight: 700 }}>ENDPOINT (URL)</span>
          <button className="row between" onClick={() => copy(STEPS_ENDPOINT, 'url')} style={{ width: '100%', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
            <span className="num" style={{ fontSize: '0.72rem', wordBreak: 'break-all', color: 'var(--text-muted)' }}>{STEPS_ENDPOINT}</span>
            {copied === 'url' ? <Check size={15} color="var(--success)" /> : <Copy size={15} color="var(--text-faint)" />}
          </button>
        </div>
        <div className="col gap-4">
          <span className="faint" style={{ fontSize: '0.74rem', fontWeight: 700 }}>TU TOKEN</span>
          <button className="row between" onClick={() => copy(token || '', 'token')} style={{ width: '100%', background: 'var(--bg-elev)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', textAlign: 'left' }}>
            <span className="num" style={{ fontSize: '0.72rem', wordBreak: 'break-all', color: 'var(--text-muted)' }}>{token}</span>
            {copied === 'token' ? <Check size={15} color="var(--success)" /> : <Copy size={15} color="var(--text-faint)" />}
          </button>
        </div>
      </div>

      <button className="btn btn-ghost btn-block btn-sm mt-12" onClick={() => setOpen((v) => !v)} style={{ justifyContent: 'space-between' }}>
        <span>Cómo configurar el Atajo</span>
        <ChevronRight size={16} style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {open && (
        <ol className="muted" style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: '0.84rem', lineHeight: 1.7 }}>
          <li>Abrí la app <strong>Atajos</strong> → nuevo atajo (+).</li>
          <li>Agregá la acción <strong>“Buscar muestras de salud”</strong>: Tipo = <em>Recuento de pasos</em>, y filtrá por fecha de inicio = <em>Hoy</em>.</li>
          <li>Agregá <strong>“Calcular estadísticas”</strong>: Operación = <em>Suma</em>, sobre el <em>Valor</em> de esas muestras. Eso te da el total de pasos.</li>
          <li>Agregá <strong>“Obtener contenido de URL”</strong>:
            <ul style={{ paddingLeft: 16 }}>
              <li>URL: el <strong>endpoint</strong> de arriba.</li>
              <li>Método: <strong>POST</strong>.</li>
              <li>Encabezados: <code>Content-Type</code> = <code>application/json</code>.</li>
              <li>Cuerpo: <strong>JSON</strong> con <code>token</code> = tu token, y <code>steps</code> = el resultado de la Suma.</li>
            </ul>
          </li>
          <li>Probá el atajo. En Forge deberías ver los pasos de hoy.</li>
          <li>(Automático) En la pestaña <strong>Automatización</strong> → nueva → <strong>Hora del día</strong> (ej. 23:00), diaria → “Ejecutar atajo” este, y desactivá <em>“Preguntar antes de ejecutar”</em>.</li>
        </ol>
      )}

      <p className="faint mt-12" style={{ fontSize: '0.76rem' }}>
        La fecha se toma sola (zona horaria de Paraguay). Tu token es personal: no lo compartas.
      </p>
    </Card>
  )
}
