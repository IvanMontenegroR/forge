import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Flame, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile, usePrograms } from '../data/hooks'
import * as db from '../data/db'
import { ensureStreaks, ensureWeeklyQuests, seedNewUserDefaults } from '../data/bootstrap'
import { todayStr, WEEKDAY_NAMES } from '../lib/dates'
import { Spinner } from '../components/ui'

const GOALS = [
  { id: 'recomp', label: 'Recomposición', desc: 'Ganar músculo y bajar grasa a la vez' },
  { id: 'cut', label: 'Bajar grasa', desc: 'Déficit, conservar músculo' },
  { id: 'bulk', label: 'Ganar músculo', desc: 'Superávit, foco en fuerza' },
]
const EQUIPMENT = ['Mancuernas', 'Banco plano', 'Banco reclinable', 'Caminadora', 'Barra', 'Banda elástica', 'Solo peso corporal']

export default function Onboarding() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: profile } = useProfile()
  const { data: programs, isLoading } = usePrograms()

  const [name, setName] = useState(profile?.full_name || '')
  const [goal, setGoal] = useState('recomp')
  const [weekdays, setWeekdays] = useState([1, 2, 5])
  const [equipment, setEquipment] = useState(['Mancuernas', 'Banco plano'])
  const [programId, setProgramId] = useState(null)
  const [protein, setProtein] = useState(145)
  const [busy, setBusy] = useState(false)

  if (isLoading) return <div className="app-shell"><div className="page"><Spinner label="Preparando…" /></div></div>

  const preset = programs?.find((p) => p.slug === 'preset-recomp')
  const chosenProgram = programId ?? preset?.id ?? programs?.[0]?.id

  const toggle = (arr, v, set) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  async function finish() {
    setBusy(true)
    try {
      await db.updateProfile(user.id, {
        full_name: name || 'Atleta',
        goal,
        training_weekdays: weekdays.sort((a, b) => a - b),
        equipment,
        active_program_id: chosenProgram,
        protein_goal_g: Number(protein) || 140,
        muscle_memory_start: todayStr(),
        onboarded: true,
      })
      await seedNewUserDefaults(user.id)
      await ensureStreaks(user.id)
      const fresh = await db.getProfile(user.id)
      await ensureWeeklyQuests(user.id, fresh)
      qc.invalidateQueries()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="page" style={{ paddingTop: 32 }}>
        <div className="center" style={{ marginBottom: 20 }}>
          <span style={{ width: 48, height: 48, borderRadius: 14, display: 'inline-grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)' }}><Flame size={26} /></span>
          <h1 style={{ marginTop: 10 }}>Bienvenido a Forge</h1>
          <p className="muted mt-8">Cuatro datos rápidos y arrancamos.</p>
        </div>

        <div className="card">
          <div className="field">
            <label htmlFor="on-name">¿Cómo te llamás?</label>
            <input id="on-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" />
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Tu objetivo</h3>
          <div className="col gap-8">
            {GOALS.map((g) => (
              <button key={g.id} className="list-row" onClick={() => setGoal(g.id)}
                style={{ background: goal === g.id ? 'var(--accent-soft)' : 'transparent', border: `1px solid ${goal === g.id ? 'var(--accent)' : 'transparent'}`, borderRadius: 12, padding: '12px', cursor: 'pointer', textAlign: 'left' }}>
                <div className="grow">
                  <strong>{g.label}</strong>
                  <p className="muted" style={{ fontSize: '0.82rem' }}>{g.desc}</p>
                </div>
                {goal === g.id && <Check size={20} color="var(--accent)" />}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Días de entreno</h3>
          <div className="row wrap gap-8">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <button key={d} className="chip" aria-pressed={weekdays.includes(d)} onClick={() => toggle(weekdays, d, setWeekdays)}>
                {WEEKDAY_NAMES[d]}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Equipo disponible</h3>
          <div className="row wrap gap-8">
            {EQUIPMENT.map((e) => (
              <button key={e} className="chip" aria-pressed={equipment.includes(e)} onClick={() => toggle(equipment, e, setEquipment)}>{e}</button>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 className="card-title">Programa</h3>
          <div className="col gap-8">
            {programs?.map((p) => (
              <button key={p.id} onClick={() => setProgramId(p.id)}
                style={{ background: chosenProgram === p.id ? 'var(--accent-soft)' : 'var(--bg-elev)', border: `1px solid ${chosenProgram === p.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, padding: 12, cursor: 'pointer', textAlign: 'left' }}>
                <div className="row between">
                  <strong>{p.name}</strong>
                  {chosenProgram === p.id && <Check size={18} color="var(--accent)" />}
                </div>
                {p.description && <p className="muted mt-8" style={{ fontSize: '0.82rem' }}>{p.description}</p>}
              </button>
            ))}
          </div>
          <div className="field mt-16">
            <label htmlFor="on-prot">Meta de proteína diaria (g)</label>
            <input id="on-prot" className="input num" type="number" value={protein} onChange={(e) => setProtein(e.target.value)} />
          </div>
        </div>

        <button className="btn btn-primary btn-block btn-lg mt-16" onClick={finish} disabled={busy || weekdays.length === 0}>
          {busy ? 'Creando tu plan…' : 'Empezar a forjar'}
        </button>
      </div>
    </div>
  )
}
