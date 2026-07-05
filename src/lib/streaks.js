// ============================================================
// Motor de rachas — se calculan al vuelo desde los datos, no se
// guardan contadores (robusto ante ediciones de días pasados).
//
// evalForDate(dateStr) => 'good' | 'bad' | 'skip'
//   good  suma a la racha
//   bad   día fallado (cada semana lun–dom tolera `allowance`; el
//         siguiente corta la racha)
//   skip  neutro (ni suma ni corta) — ej. día de descanso o sin datos
// ============================================================
import { weekStart, addDays, todayStr } from './dates'

export function computeStreak(evalForDate, { today = todayStr(), window = 120, allowance = 2 } = {}) {
  // Estados por fecha, de hoy hacia atrás
  const days = []
  for (let i = 0; i < window; i++) {
    const date = addDays(today, -i)
    days.push({ date, status: evalForDate(date) })
  }

  // Racha actual: desde hoy hacia atrás
  let current = 0
  const weekBad = new Map()
  for (const { date, status } of days) {
    if (status === 'skip') continue
    if (status === 'good') { current++; continue }
    const wk = weekStart(date)
    const used = (weekBad.get(wk) || 0) + 1
    weekBad.set(wk, used)
    if (used <= allowance) continue // perdonado: no corta, tampoco suma
    break
  }

  // Récord: escanear la ventana en orden cronológico con la misma regla
  let longest = 0, run = 0
  const weekBad2 = new Map()
  for (const { date, status } of [...days].reverse()) {
    if (status === 'skip') continue
    if (status === 'good') { run++; longest = Math.max(longest, run); continue }
    const wk = weekStart(date)
    const used = (weekBad2.get(wk) || 0) + 1
    weekBad2.set(wk, used)
    if (used > allowance) run = 0
  }
  longest = Math.max(longest, current)

  return { current, longest, days }
}
