// Pequeños componentes de UI reutilizables.
import { Loader2 } from 'lucide-react'

export function Spinner({ label }) {
  return (
    <div className="empty" role="status">
      <Loader2 className="spin" size={26} style={{ animation: 'spin 1s linear infinite' }} />
      {label && <p className="muted mt-8">{label}</p>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

export function Empty({ icon = '·', title, children }) {
  return (
    <div className="empty">
      <div className="ico" aria-hidden>{icon}</div>
      {title && <strong>{title}</strong>}
      {children && <p className="mt-8" style={{ fontSize: '0.9rem' }}>{children}</p>}
    </div>
  )
}

export function Card({ title, action, children, className = '', style }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || action) && (
        <div className="row between" style={{ marginBottom: 12 }}>
          {title && <h3 className="card-title" style={{ margin: 0 }}>{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Stat({ value, label, suffix, color }) {
  return (
    <div className="stat">
      <span className="v" style={color ? { color } : undefined}>
        {value}{suffix && <span style={{ fontSize: '0.7em', color: 'var(--text-faint)' }}> {suffix}</span>}
      </span>
      <span className="l">{label}</span>
    </div>
  )
}

export function ProgressBar({ value, max = 1, variant = '' }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100))
  return (
    <div className={`bar ${variant}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

// Anillo de progreso circular (para el nivel)
export function Ring({ progress = 0, size = 30, stroke = 4, color = 'var(--accent)', children }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.max(0, Math.min(1, progress)))
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      {children && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: size * 0.34, fontWeight: 800 }}>
          {children}
        </div>
      )}
    </div>
  )
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 9999, decimals = 0, block = false }) {
  const fmt = (n) => (decimals ? Number(n).toFixed(decimals) : String(n))
  const clamp = (n) => Math.max(min, Math.min(max, n))
  return (
    <div className={`stepper${block ? ' block' : ''}`}>
      <button type="button" aria-label="menos" onClick={() => onChange(clamp(Number(value) - step))}>−</button>
      <input className="num" inputMode="decimal" value={fmt(value)}
        onChange={(e) => { const n = parseFloat(e.target.value); if (!Number.isNaN(n)) onChange(clamp(n)) }} />
      <button type="button" aria-label="más" onClick={() => onChange(clamp(Number(value) + step))}>+</button>
    </div>
  )
}
