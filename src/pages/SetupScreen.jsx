import { Flame } from 'lucide-react'

// Se muestra cuando faltan las variables de Supabase en el frontend.
export default function SetupScreen() {
  return (
    <div className="app-shell">
      <div className="page">
        <div className="row gap-8" style={{ marginBottom: 16 }}>
          <span className="logo" style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <Flame size={20} />
          </span>
          <h1>Forge</h1>
        </div>
        <div className="card">
          <h3 className="card-title">Falta configurar Supabase</h3>
          <p className="muted">Creá un archivo <code>.env</code> en la raíz (copiá <code>.env.example</code>) con:</p>
          <pre style={{ background: 'var(--bg-elev)', padding: 12, borderRadius: 12, overflow: 'auto', fontSize: '0.82rem' }}>
{`VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
          </pre>
          <p className="muted mt-12">Después reiniciá <code>npm run dev</code>. El README tiene el paso a paso completo.</p>
        </div>
      </div>
    </div>
  )
}
