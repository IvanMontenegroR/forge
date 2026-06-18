import { useState } from 'react'
import { Flame } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Auth() {
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [err, setErr] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setErr(null); setMsg(null)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name } },
        })
        if (error) throw error
        setMsg('Cuenta creada. Si tu proyecto pide confirmación por email, revisá tu casilla. Si no, ya podés entrar.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (e) {
      setErr(e.message || 'Algo salió mal.')
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
          <h1 style={{ marginTop: 12 }}>Forge</h1>
          <p className="muted mt-8">Entrená. Registrá. Subí de nivel.</p>
        </div>

        <form className="card" onSubmit={submit}>
          <div className="row" style={{ background: 'var(--bg-elev)', borderRadius: 12, padding: 4, marginBottom: 16 }}>
            <button type="button" className={`btn btn-sm grow ${mode === 'signin' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('signin')} style={{ border: 'none' }}>Entrar</button>
            <button type="button" className={`btn btn-sm grow ${mode === 'signup' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode('signup')} style={{ border: 'none' }}>Crear cuenta</button>
          </div>

          {mode === 'signup' && (
            <div className="field">
              <label htmlFor="name">Nombre</label>
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vos@email.com" autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="pass">Contraseña</label>
            <input id="pass" className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
          </div>

          {err && <p className="pill" style={{ color: 'var(--danger)', background: 'var(--danger-soft)', width: '100%', justifyContent: 'flex-start', marginBottom: 10 }}>{err}</p>}
          {msg && <p className="pill" style={{ color: 'var(--success)', background: 'var(--success-soft)', width: '100%', justifyContent: 'flex-start', marginBottom: 10 }}>{msg}</p>}

          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

        <p className="faint center mt-16" style={{ fontSize: '0.8rem' }}>
          Tus datos quedan protegidos por Row Level Security: solo vos ves lo tuyo.
        </p>
      </div>
    </div>
  )
}
