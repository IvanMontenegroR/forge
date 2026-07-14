// Rutina rotativa: el próximo día es el siguiente en la secuencia
// (Día 1 → 2 → 3 → 1…), según la última sesión completada — sin importar
// el día de la semana. Así se puede entrenar cualquier día y compensar.

export function nextRotationDay(programDays, sessions) {
  const days = [...(programDays || [])].sort((a, b) => a.order_index - b.order_index)
  if (!days.length) return null
  const completed = (sessions || []).filter((s) => s.status === 'completed') // useSessions viene desc por fecha
  let lastIdx = -1
  for (const s of completed) {
    const i = days.findIndex((d) => d.id === s.program_day_id)
    if (i !== -1) { lastIdx = i; break }
  }
  const nextIdx = lastIdx === -1 ? 0 : (lastIdx + 1) % days.length
  return days[nextIdx]
}
