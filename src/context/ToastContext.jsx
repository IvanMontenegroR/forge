import { createContext, useContext, useCallback, useState } from 'react'
import { Sparkles, Trophy, CheckCircle2, Info } from 'lucide-react'

const ToastCtx = createContext(null)
let idSeq = 0

const ICONS = {
  xp: Sparkles,
  badge: Trophy,
  success: CheckCircle2,
  info: Info,
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const push = useCallback((toast) => {
    const id = ++idSeq
    const t = { id, type: 'info', ttl: 3200, ...toast }
    setToasts((cur) => [...cur, t])
    setTimeout(() => remove(id), t.ttl)
  }, [remove])

  const api = {
    toast: push,
    xp: (amount, label) => push({ type: 'xp', title: `+${amount} XP`, body: label }),
    badge: (name) => push({ type: 'badge', title: '¡Logro desbloqueado!', body: name, ttl: 4200 }),
    success: (title, body) => push({ type: 'success', title, body }),
    info: (title, body) => push({ type: 'info', title, body }),
  }

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toast-wrap" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info
          return (
            <div key={t.id} className={`toast ${t.type}`} role="status" onClick={() => remove(t.id)}>
              <Icon size={20} color={t.type === 'xp' ? 'var(--xp)' : t.type === 'badge' ? 'var(--gold)' : t.type === 'success' ? 'var(--success)' : 'var(--info)'} />
              <div className="col" style={{ gap: 1 }}>
                <strong style={{ fontSize: '0.92rem' }}>{t.title}</strong>
                {t.body && <span className="muted" style={{ fontSize: '0.82rem' }}>{t.body}</span>}
              </div>
            </div>
          )
        })}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('useToast fuera de ToastProvider')
  return ctx
}
