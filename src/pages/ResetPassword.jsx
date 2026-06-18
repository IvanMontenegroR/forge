import { useState } from 'react'
import { Flame } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function ResetPassword() {
  const { endRecovery, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr(null)
    if (password !== confirm) {
      setErr('Las contraseñas no coinciden.')
      return
    }
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setDone(true)
      endRecovery()
    } catch (e) {
      setErr(e.message || 'No se pudo cambiar la contraseña.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="page" style={{ paddingTop: 48 }}>
        <div className="center" style={{ marginBottom: 28 }}>
          <span style={{ width: 56, height: 56, borderRadius: 16, display: 'inline-grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Flame size={30} />
          </span>
          <h1 style={{ marginTop: 12 }}>Nueva contraseña</h1>
          <p className="muted mt-8">Elegí una contraseña nueva para tu cuenta.</p>
        </div>

        {done ? (
          <div className="card center">
            <p className="pill" style={{ color: 'var(--success)', background: 'var(--success-soft)', width: '100%', justifyContent: 'flex-start', marginBottom: 14 }}>
              ✓ Contraseña actualizada. Ya podés usar la app.
            </p>
            <button className="btn btn-primary btn-block btn-lg" onClick={endRecovery}>Continuar</button>
          </div>
        ) : (
          <form className="card" onSubmit={submit}>
            <div className="field">
              <label htmlFor="new-pass">Nueva contraseña</label>
              <input id="new-pass" className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            </div>
            <div className="field">
              <label htmlFor="confirm-pass">Repetir contraseña</label>
              <input id="confirm-pass" className="input" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            </div>

            {err && <p className="pill" style={{ color: 'var(--danger)', background: 'var(--danger-soft)', width: '100%', justifyContent: 'flex-start', marginBottom: 10 }}>{err}</p>}

            <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar contraseña'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm btn-block mt-12" style={{ border: 'none' }} onClick={() => { endRecovery(); signOut() }} disabled={busy}>
              Cancelar
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
