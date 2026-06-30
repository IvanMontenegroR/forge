// Helpers de fechas. Trabajamos con strings YYYY-MM-DD en hora local
// para evitar líos de timezone con las columnas `date` de Postgres.

export function todayStr(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 1 = lunes ... 7 = domingo (coincide con weekday en program_days)
export function isoWeekday(d = new Date()) {
  const wd = d.getDay() // 0=dom..6=sab
  return wd === 0 ? 7 : wd
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return todayStr(d)
}

export function daysBetween(a, b) {
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return Math.round((db - da) / 86400000)
}

// Lunes de la semana de la fecha dada
export function weekStart(dateStr = todayStr()) {
  const d = new Date(dateStr + 'T00:00:00')
  const wd = isoWeekday(d)
  d.setDate(d.getDate() - (wd - 1))
  return todayStr(d)
}

// Primer y último día del mes de la fecha dada (YYYY-MM-DD)
export function monthStart(dateStr = todayStr()) {
  return dateStr.slice(0, 8) + '01'
}
export function monthEnd(dateStr = todayStr()) {
  const d = new Date(dateStr + 'T00:00:00')
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return todayStr(last)
}
export function monthLabel(dateStr = todayStr()) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es', { month: 'long', year: 'numeric' })
}

export const WEEKDAY_NAMES = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const WEEKDAY_LONG = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function prettyDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' })
}
