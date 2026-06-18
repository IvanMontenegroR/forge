// ============================================================
// Lógica de gamificación (pura, sin DB).
// Principio de diseño: premiar consistencia y recuperación.
// Nunca incentivar sobreentrenar ni loguear de más.
// ============================================================

// XP por acción real. Una sola vez por día/evento (lo controla la capa de datos).
export const XP = {
  session_complete: 60,
  pr: 40,
  protein_goal: 25,
  supplements_all: 15,
  creatine: 8,
  sleep_goal: 20,      // recuperación da XP
  steps_goal: 15,
  body_metrics: 30,    // medición semanal
  rest_day: 10,        // respetar el descanso programado también suma
  quest_bonus: 0,      // lo define cada quest
}

// Curva de niveles: XP acumulada para alcanzar el nivel L = 50 * (L-1) * L
// L1=0, L2=100, L3=300, L4=600, L5=1000, ...
export function cumXpForLevel(level) {
  return 50 * (level - 1) * level
}

export function levelFromXp(xp) {
  const x = Math.max(0, xp | 0)
  let level = 1
  while (cumXpForLevel(level + 1) <= x) level++
  const base = cumXpForLevel(level)
  const next = cumXpForLevel(level + 1)
  const intoLevel = x - base
  const span = next - base
  return {
    level,
    rank: rankFor(level),
    xp: x,
    intoLevel,
    span,
    toNext: next - x,
    progress: Math.min(1, intoLevel / span),
  }
}

const RANKS = [
  { min: 1, name: 'Novato', color: 'var(--text-muted)' },
  { min: 3, name: 'Constante', color: 'var(--info)' },
  { min: 6, name: 'Forjado', color: 'var(--accent)' },
  { min: 10, name: 'Veterano', color: 'var(--success)' },
  { min: 15, name: 'Élite', color: 'var(--xp)' },
  { min: 21, name: 'Leyenda', color: 'var(--gold)' },
]

export function rankFor(level) {
  let r = RANKS[0]
  for (const rank of RANKS) if (level >= rank.min) r = rank
  return r
}

// Multiplicador de XP activo durante la ventana muscle memory.
export const MUSCLE_MEMORY_MULTIPLIER = 1.5

export function muscleMemoryState(startStr, days, todayStr) {
  if (!startStr) return { active: false, daysLeft: 0, multiplier: 1 }
  const start = new Date(startStr + 'T00:00:00')
  const today = new Date(todayStr + 'T00:00:00')
  const elapsed = Math.floor((today - start) / 86400000)
  const daysLeft = days - elapsed
  const active = elapsed >= 0 && daysLeft > 0
  return {
    active,
    daysLeft: Math.max(0, daysLeft),
    elapsed,
    total: days,
    multiplier: active ? MUSCLE_MEMORY_MULTIPLIER : 1,
  }
}

// Plantillas de misiones semanales que se renuevan.
export function defaultWeeklyQuests(profile) {
  const sessions = (profile?.training_weekdays?.length) || 3
  return [
    { code: 'sessions', title: `Completá ${sessions} sesiones`, target: sessions, xp_reward: 80 },
    { code: 'hiit', title: `${profile?.hiit_per_week ?? 2} sesiones de HIIT`, target: profile?.hiit_per_week ?? 2, xp_reward: 50 },
    { code: 'protein', title: 'Cumplí la proteína 5 días', target: 5, xp_reward: 60 },
    { code: 'creatine', title: 'Creatina 7 días', target: 7, xp_reward: 40 },
    { code: 'sleep', title: 'Dormí tu meta 5 noches', target: 5, xp_reward: 60 },
  ]
}
