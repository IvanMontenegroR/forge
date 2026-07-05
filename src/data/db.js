// ============================================================
// Acceso a datos (Supabase). Funciones async puras; los hooks de
// React Query las envuelven en src/data/hooks.js.
// Todas las escrituras incluyen user_id; RLS garantiza el aislamiento.
// ============================================================
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/dates'

function uid() {
  // Se asume sesión activa; las llamadas se hacen detrás del guard.
  return supabase.auth.getUser().then(({ data }) => data.user?.id)
}

// ---------- Profile ----------
export async function getProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function updateProfile(userId, patch) {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select().single()
  if (error) throw error
  return data
}

// ---------- Programas / días ----------
export async function listPrograms() {
  const { data, error } = await supabase.from('programs').select('*').order('is_preset', { ascending: false })
  if (error) throw error
  return data
}

export async function getProgramDays(programId) {
  if (!programId) return []
  const { data, error } = await supabase
    .from('program_days')
    .select('*, program_day_exercises(*, exercise:exercises(*))')
    .eq('program_id', programId)
    .order('order_index')
  if (error) throw error
  // ordenar ejercicios dentro de cada día
  for (const d of data) {
    d.program_day_exercises?.sort((a, b) => a.order_index - b.order_index)
  }
  return data
}

// ---------- Sesiones / sets ----------
export async function getSessionByDate(userId, date = todayStr()) {
  const { data, error } = await supabase
    .from('sessions').select('*').eq('user_id', userId).eq('date', date)
    .order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return data
}

export async function listSessions(userId, limit = 60) {
  const { data, error } = await supabase
    .from('sessions').select('*').eq('user_id', userId)
    .order('date', { ascending: false }).limit(limit)
  if (error) throw error
  return data
}

export async function createSession(userId, { programDayId, title, date = todayStr() }) {
  const { data, error } = await supabase.from('sessions')
    .insert({ user_id: userId, program_day_id: programDayId, title, date, status: 'active' })
    .select().single()
  if (error) throw error
  return data
}

export async function getSessionSets(sessionId) {
  const { data, error } = await supabase.from('set_logs').select('*').eq('session_id', sessionId).order('created_at')
  if (error) throw error
  return data
}

export async function upsertSet(row) {
  const { data, error } = await supabase.from('set_logs').upsert(row).select().single()
  if (error) throw error
  return data
}

export async function deleteSet(id) {
  const { error } = await supabase.from('set_logs').delete().eq('id', id)
  if (error) throw error
}

export async function completeSession(sessionId, { totalVolume, notes }) {
  const { data, error } = await supabase.from('sessions')
    .update({ status: 'completed', completed_at: new Date().toISOString(), total_volume_kg: totalVolume, notes })
    .eq('id', sessionId).select().single()
  if (error) throw error
  return data
}

// Última sesión COMPLETADA previa que incluyó un ejercicio dado.
export async function getPreviousSetsForExercise(userId, exerciseId, beforeSessionId) {
  // sets del usuario para ese ejercicio, agrupados por sesión, la más reciente que no sea la actual
  const { data, error } = await supabase
    .from('set_logs')
    .select('*, session:sessions(id, date, status)')
    .eq('user_id', userId).eq('exercise_id', exerciseId).eq('is_warmup', false)
    .order('created_at', { ascending: false })
    .limit(60)
  if (error) throw error
  const bySession = new Map()
  for (const s of data) {
    if (s.session_id === beforeSessionId) continue
    if (s.session?.status !== 'completed') continue
    if (!bySession.has(s.session_id)) bySession.set(s.session_id, { date: s.session.date, sets: [] })
    bySession.get(s.session_id).sets.push(s)
  }
  const sessions = [...bySession.values()].sort((a, b) => (a.date < b.date ? 1 : -1))
  const prev = sessions[0]
  if (prev) prev.sets.sort((a, b) => a.set_number - b.set_number)
  return prev || null
}

// Historial completo de un ejercicio (para gráfico de progresión + PRs).
export async function getExerciseHistory(userId, exerciseId) {
  const { data, error } = await supabase
    .from('set_logs')
    .select('*, session:sessions(date, status)')
    .eq('user_id', userId).eq('exercise_id', exerciseId).eq('is_warmup', false)
    .order('created_at')
  if (error) throw error
  return data.filter((s) => s.session?.status === 'completed')
}

export async function listExercises() {
  const { data, error } = await supabase.from('exercises').select('*').order('muscle_group')
  if (error) throw error
  return data
}

// ---------- Métricas corporales ----------
export async function listBodyMetrics(userId) {
  const { data, error } = await supabase.from('body_metrics').select('*').eq('user_id', userId).order('date')
  if (error) throw error
  return data
}
export async function upsertBodyMetric(userId, row) {
  const { data, error } = await supabase.from('body_metrics')
    .upsert({ ...row, user_id: userId }, { onConflict: 'user_id,date' }).select().single()
  if (error) throw error
  return data
}

// ---------- Nutrición ----------
export async function listUserFoods(userId) {
  const { data, error } = await supabase.from('user_foods').select('*').eq('user_id', userId).order('sort_order')
  if (error) throw error
  return data
}
export async function getNutritionByDate(userId, date = todayStr()) {
  const { data, error } = await supabase.from('nutrition_logs').select('*').eq('user_id', userId).eq('date', date).order('created_at')
  if (error) throw error
  return data
}
// Registros de nutrición en un rango de fechas [from, to] inclusive (YYYY-MM-DD).
export async function getNutritionRange(userId, from, to) {
  const { data, error } = await supabase.from('nutrition_logs')
    .select('*').eq('user_id', userId).gte('date', from).lte('date', to).order('date')
  if (error) throw error
  return data
}
export async function addNutrition(userId, row) {
  const { data, error } = await supabase.from('nutrition_logs').insert({ ...row, user_id: userId }).select().single()
  if (error) throw error
  return data
}
export async function deleteNutrition(id) {
  const { error } = await supabase.from('nutrition_logs').delete().eq('id', id)
  if (error) throw error
}

// ---------- Suplementos ----------
export async function listSupplements(userId) {
  const { data, error } = await supabase.from('user_supplements').select('*').eq('user_id', userId).order('sort_order')
  if (error) throw error
  return data
}
export async function updateSupplement(id, patch) {
  const { data, error } = await supabase.from('user_supplements').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}
export async function getSupplementLogs(userId, date = todayStr()) {
  const { data, error } = await supabase.from('supplement_logs').select('*').eq('user_id', userId).eq('date', date)
  if (error) throw error
  return data
}
export async function toggleSupplementLog(userId, supplementId, date, taken) {
  if (taken) {
    const { data, error } = await supabase.from('supplement_logs')
      .upsert({ user_id: userId, user_supplement_id: supplementId, date, taken: true, taken_at: new Date().toISOString() },
        { onConflict: 'user_supplement_id,date' }).select().single()
    if (error) throw error
    return data
  }
  const { error } = await supabase.from('supplement_logs').delete().eq('user_supplement_id', supplementId).eq('date', date)
  if (error) throw error
  return null
}

// ---------- Sueño ----------
export async function listSleep(userId, limit = 30) {
  const { data, error } = await supabase.from('sleep_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(limit)
  if (error) throw error
  return data
}
export async function upsertSleep(userId, row) {
  const { data, error } = await supabase.from('sleep_logs').upsert({ ...row, user_id: userId }, { onConflict: 'user_id,date' }).select().single()
  if (error) throw error
  return data
}

// ---------- Cardio ----------
export async function listCardio(userId, limit = 60) {
  const { data, error } = await supabase.from('cardio_logs').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(limit)
  if (error) throw error
  return data
}
export async function addCardio(userId, row) {
  const { data, error } = await supabase.from('cardio_logs').insert({ ...row, user_id: userId }).select().single()
  if (error) throw error
  return data
}
// Fija los pasos del día (reemplaza el registro de pasos de esa fecha).
export async function setSteps(userId, date, steps) {
  await supabase.from('cardio_logs').delete().eq('user_id', userId).eq('date', date).eq('type', 'steps')
  const { data, error } = await supabase.from('cardio_logs')
    .insert({ user_id: userId, date, type: 'steps', steps }).select().single()
  if (error) throw error
  return data
}

export async function getStepsByDate(userId, date = todayStr()) {
  const { data, error } = await supabase.from('cardio_logs').select('steps').eq('user_id', userId).eq('date', date).eq('type', 'steps')
  if (error) throw error
  return data.reduce((s, r) => s + (r.steps || 0), 0)
}

export { uid }
