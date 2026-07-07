import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Sparkles, Check, AlertCircle } from 'lucide-react'
import { usePrograms, qk } from '../data/hooks'
import * as db from '../data/db'
import { Spinner } from './ui'

// Selector de programa: elegir un preset/propio o generar uno con IA.
// props: payload (datos para la IA), selectedId, onSelect(id)
export default function ProgramPicker({ payload, selectedId, onSelect }) {
  const qc = useQueryClient()
  const { data: programs } = usePrograms()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [generated, setGenerated] = useState(null)

  async function generate() {
    setBusy(true); setErr(null); setGenerated(null)
    try {
      const { data, error } = await db.generateProgramAI(payload)
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      await qc.invalidateQueries({ queryKey: qk.programs() })
      qc.invalidateQueries({ queryKey: ['profile'] }) // el edge fn ya activó el programa
      setGenerated(data)
      onSelect?.(data.program_id)
    } catch (e) {
      setErr(e.message || 'No se pudo generar el programa.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="col gap-8">
      <button className="btn btn-primary btn-block" onClick={generate} disabled={busy}>
        <Sparkles size={16} /> {busy ? 'Generando tu plan…' : 'Generar con IA'}
      </button>
      <p className="faint" style={{ fontSize: '0.76rem' }}>
        La IA arma un plan según tu objetivo, datos, días y equipo. Podés cambiarlo por un preset cuando quieras.
      </p>

      {busy && <div className="mt-8"><Spinner label="La IA está diseñando tu programa…" /></div>}
      {err && (
        <div className="pill" style={{ color: 'var(--danger)', background: 'var(--danger-soft)', width: '100%', justifyContent: 'flex-start' }}>
          <AlertCircle size={14} /> {err}
        </div>
      )}
      {generated && (
        <div className="pill success" style={{ width: '100%', justifyContent: 'flex-start' }}>
          <Check size={14} /> Plan creado: {generated.name} · {generated.days} días
        </div>
      )}

      <p className="faint" style={{ fontSize: '0.76rem', marginTop: 6 }}>O elegí uno existente:</p>
      <div className="col gap-8">
        {(programs || []).map((p) => (
          <button key={p.id} onClick={() => onSelect?.(p.id)}
            style={{ background: selectedId === p.id ? 'var(--accent-soft)' : 'var(--bg-elev)', border: `1px solid ${selectedId === p.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, padding: 12, cursor: 'pointer', textAlign: 'left' }}>
            <div className="row between">
              <strong>{p.name}{!p.is_preset ? ' ·  IA/propio' : ''}</strong>
              {selectedId === p.id && <Check size={18} color="var(--accent)" />}
            </div>
            {p.description && <p className="muted mt-8" style={{ fontSize: '0.82rem' }}>{p.description}</p>}
          </button>
        ))}
      </div>
    </div>
  )
}
