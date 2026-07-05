import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Plus, Trash2, ShieldCheck, Mail } from 'lucide-react'
import { useProfile, useAllowedEmails, qk } from '../data/hooks'
import * as db from '../data/db'
import { Card, Spinner, Empty } from '../components/ui'

export default function Admin() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: profile } = useProfile()
  const isAdmin = profile?.role === 'admin'
  const { data: emails, isLoading } = useAllowedEmails(isAdmin)

  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  if (!profile) return <div className="page"><Spinner /></div>

  if (!isAdmin) {
    return (
      <div className="page">
        <div className="page-head"><p className="eyebrow">Admin</p><h1>Sin acceso</h1></div>
        <Card><Empty icon="🔒" title="No autorizado">Esta sección es solo para administradores.</Empty></Card>
        <button className="btn btn-ghost btn-block mt-16" onClick={() => navigate('/')}>Volver</button>
      </div>
    )
  }

  async function add() {
    const clean = email.trim().toLowerCase()
    setErr(null)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) { setErr('Email inválido.'); return }
    setBusy(true)
    try {
      await db.addAllowedEmail(clean, note)
      setEmail(''); setNote('')
      qc.invalidateQueries({ queryKey: qk.allowedEmails() })
    } catch (e) {
      setErr(e.message?.includes('duplicate') ? 'Ese email ya está en la lista.' : (e.message || 'No se pudo agregar.'))
    } finally {
      setBusy(false)
    }
  }

  async function remove(e) {
    await db.removeAllowedEmail(e)
    qc.invalidateQueries({ queryKey: qk.allowedEmails() })
  }

  return (
    <div className="page">
      <div className="row between" style={{ marginBottom: 12 }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/profile')} aria-label="Volver"><ChevronLeft size={20} /></button>
        <strong className="row gap-8"><ShieldCheck size={18} color="var(--accent)" /> Admin</strong>
        <div style={{ width: 40 }} />
      </div>

      <Card title="Registro">
        <p className="muted" style={{ fontSize: '0.88rem' }}>
          Solo los emails de esta lista pueden crear una cuenta. Agregá el email de quien quieras dejar entrar; después esa persona se registra normalmente en la pantalla de inicio.
        </p>
        <div className="col gap-8 mt-12">
          <input className="input" type="email" placeholder="email@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          <div className="row gap-8">
            <input className="input grow" placeholder="Nota (opcional): quién es" value={note} onChange={(e) => setNote(e.target.value)} />
            <button className="btn btn-primary btn-icon" onClick={add} disabled={busy} aria-label="agregar"><Plus size={18} /></button>
          </div>
          {err && <p className="pill" style={{ color: 'var(--danger)', background: 'var(--danger-soft)', width: '100%', justifyContent: 'flex-start' }}>{err}</p>}
        </div>
      </Card>

      <Card title={`Emails autorizados (${emails?.length || 0})`}>
        {isLoading ? <Spinner /> : emails?.length ? (
          <div className="col">
            {emails.map((r) => (
              <div key={r.email} className="list-row">
                <span className="lead" style={{ width: 34, height: 34, background: 'var(--surface-2)', color: 'var(--info)' }}><Mail size={15} /></span>
                <div className="grow">
                  <strong style={{ fontSize: '0.9rem' }}>{r.email}</strong>
                  {r.note && <span className="faint" style={{ display: 'block', fontSize: '0.78rem' }}>{r.note}</span>}
                </div>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => remove(r.email)} aria-label="quitar"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        ) : <Empty icon="✉️" title="Lista vacía">Nadie puede registrarse todavía.</Empty>}
      </Card>

      <p className="faint center mt-16" style={{ fontSize: '0.78rem' }}>
        Quitar un email de la lista no borra la cuenta de quien ya se registró; solo impide nuevos registros con ese email.
      </p>
    </div>
  )
}
