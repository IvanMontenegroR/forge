import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Flame, Check, Dumbbell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProfile, usePrograms } from '../data/hooks'
import * as db from '../data/db'
import { seedNewUserDefaults } from '../data/bootstrap'
import { WEEKDAY_NAMES } from '../lib/dates'
import { Spinner } from '../components/ui'

const GOALS = [
  { id: 'recomp', label: 'Recomposición', desc: 'Ganar músculo y bajar grasa a la vez' },
  { id: 'cut', label: 'Bajar grasa', desc: 'Déficit, conservar músculo' },
  { id: 'bulk', label: 'Ganar músculo', desc: 'Superávit, foco en fuerza' },
]
const EQUIPMENT = ['Mancuernas', 'Banco plano', 'Banco reclinable', 'Caminadora', 'Barra', 'Banda elástica', 'Solo peso corporal']

// Estimación de calorías (Mifflin-St Jeor + actividad moderada) según objetivo.
function suggestKcal({ sex, age, height, weight, goal }) {
  const a = Number(age), h = Number(height), w = Number(weight)
  if (!a || !h || !w) return null
  const bmr = 10 * w + 6.25 * h - 5 * a + (sex === 'f' ? -161 : 5)
  const maint = Math.round((bmr * 1.45) / 10) * 10
  const factor = goal === 'bulk' ? 1.1 : goal === 'cut' ? 0.8 : 0.85 // recomp = leve déficit
  const target = Math.round((maint * factor) / 10) * 10
  return { maint, target }
}

export default function Onboarding() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const { data: profile } = useProfile()
  const { data: programs, isLoading } = usePrograms()

  const [name, setName] = useState(profile?.full_name || '')
  const [goal, setGoal] = useState('recomp')
  const [sex, setSex] = useState('m')
  const [age, setAge] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const [targetKcal, setTargetKcal] = useState('')
  const [weekdays, setWeekdays] = useState([1, 2, 5])
  const [gym, setGym] = useState(false)
  const [equipment, setEquipment] = useState(['Mancuernas', 'Banco plano'])
  const [programId, setProgramId] = useState(null)
  const [protein, setProtein] = useState(145)
  const [busy, setBusy] = useState(false)

  if (isLoading) return <div className="app-shell"><div className="page"><Spinner label="Preparando…" /></div></div>

  const preset = programs?.find((p) => p.slug === 'preset-recomp')
  const chosenProgram = programId ?? preset?.id ?? programs?.[0]?.id
  const sug = suggestKcal({ sex, age, height, weight, goal })
  const finalKcal = Number(targetKcal) || sug?.target || null

  const toggle = (arr, v, set) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  async function finish() {
    setBusy(true)
    try {
      await db.updateProfile(user.id, {
        full_name: name || 'Atleta',
        goal,
        age: Number(age) || null,
        height_cm: Number(height) || null,
        start_weight_kg: Number(weight) || null,
        maintenance_kcal: sug?.maint || null,
        target_kcal: finalKcal || 2050,
        training_weekdays: weekdays.sort((a, b) => a - b),
        equipment: gym ? ['Gimnasio (equipo completo)', ...EQUIPMENT] : equipment,
        active_program_id: chosenProgram,
        protein_goal_g: Number(protein) || 140,
        onboarded: true,
      })
      await seedNewUserDefaults(user.id)
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
          <p className="muted mt-8">Unos datos y armamos tu plan.</p>
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
          <h3 className="card-title">Tus datos</h3>
          <div className="row gap-8" style={{ marginBottom: 12 }}>
            <button className={`btn btn-sm grow ${sex === 'm' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSex('m')} style={{ border: 'none' }}>Hombre</button>
            <button className={`btn btn-sm grow ${sex === 'f' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setSex('f')} style={{ border: 'none' }}>Mujer</button>
          </div>
          <div className="row gap-8">
            <div className="field grow" style={{ marginBottom: 0 }}>
              <label htmlFor="on-age">Edad</label>
              <input id="on-age" className="input num" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} placeholder="26" />
            </div>
            <div className="field grow" style={{ marginBottom: 0 }}>
              <label htmlFor="on-h">Altura (cm)</label>
              <input id="on-h" className="input num" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="170" />
            </div>
            <div className="field grow" style={{ marginBottom: 0 }}>
              <label htmlFor="on-w">Peso (kg)</label>
              <input id="on-w" className="input num" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="70" />
            </div>
          </div>

          <div className="field mt-16" style={{ marginBottom: 0 }}>
            <label htmlFor="on-kcal">Meta de calorías (kcal/día)</label>
            <input id="on-kcal" className="input num" inputMode="numeric"
              value={targetKcal} onChange={(e) => setTargetKcal(e.target.value)}
              placeholder={sug ? String(sug.target) : '2050'} />
          </div>
          {sug && (
            <div className="row between mt-8" style={{ fontSize: '0.78rem' }}>
              <span className="faint">Sugerido: mantenimiento ~{sug.maint} · objetivo ~{sug.target}</span>
              <button className="btn btn-ghost btn-sm" style={{ border: 'none', color: 'var(--accent)' }} onClick={() => setTargetKcal(String(sug.target))}>Usar</button>
            </div>
          )}
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
          <button className="btn btn-block" onClick={() => setGym((v) => !v)}
            style={{ background: gym ? 'var(--accent-soft)' : 'var(--surface-2)', border: `1px solid ${gym ? 'var(--accent)' : 'var(--border)'}`, color: gym ? 'var(--accent)' : 'var(--text)', justifyContent: 'flex-start', gap: 10 }}>
            <Dumbbell size={18} /> Voy al gimnasio (tengo todo el equipo) {gym && <Check size={16} style={{ marginLeft: 'auto' }} />}
          </button>
          {!gym && (
            <div className="row wrap gap-8 mt-12">
              {EQUIPMENT.map((e) => (
                <button key={e} className="chip" aria-pressed={equipment.includes(e)} onClick={() => toggle(equipment, e, setEquipment)}>{e}</button>
              ))}
            </div>
          )}
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
