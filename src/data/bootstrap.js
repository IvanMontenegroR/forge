// Helpers que aseguran que existan filas base (streaks, misiones de la
// semana). Idempotentes; se llaman al entrar y al completar el onboarding.
import { supabase } from '../lib/supabase'
import { weekStart } from '../lib/dates'
import { defaultWeeklyQuests } from '../lib/gamification'
import * as db from './db'

export async function ensureStreaks(userId) {
  const existing = await db.getStreaks(userId)
  const kinds = ['workout', 'creatine', 'steps', 'protein']
  const missing = kinds.filter((k) => !existing.some((s) => s.kind === k))
  if (missing.length) {
    await supabase.from('streaks').upsert(
      missing.map((kind) => ({ user_id: userId, kind })),
      { onConflict: 'user_id,kind' },
    )
  }
}

export async function ensureWeeklyQuests(userId, profile) {
  const week = weekStart()
  const existing = await db.getWeeklyQuests(userId, week)
  if (existing.length) return existing
  const rows = defaultWeeklyQuests(profile).map((q) => ({ ...q, user_id: userId, week_start: week, progress: 0, completed: false }))
  return db.upsertQuests(rows)
}

const DEFAULT_FOODS = [
  { name: 'Huevo', protein_g: 6, kcal: 78, serving: '1 unidad' },
  { name: 'Pollo', protein_g: 31, kcal: 165, serving: '100 g' },
  { name: 'Whey', protein_g: 24, kcal: 120, serving: '1 scoop' },
  { name: 'Atún', protein_g: 25, kcal: 116, serving: '100 g' },
  { name: 'Arroz', protein_g: 4, kcal: 205, serving: '1 taza' },
  { name: 'Banana', protein_g: 1, kcal: 105, serving: '1 unidad' },
]

const DEFAULT_SUPPS = [
  { name: 'Whey', dose: '1–2 scoops', timing: 'Para cerrar la proteína', active: true, track_streak: false },
  { name: 'Creatina', dose: '5 g', timing: 'Cualquier hora', active: true, track_streak: true },
]

// Para usuarios nuevos: comidas y suplementos por defecto (editables luego).
export async function seedNewUserDefaults(userId) {
  const foods = await db.listUserFoods(userId)
  if (foods.length === 0) {
    await supabase.from('user_foods').insert(DEFAULT_FOODS.map((f, i) => ({ ...f, user_id: userId, sort_order: i })))
  }
  const supps = await db.listSupplements(userId)
  if (supps.length === 0) {
    await supabase.from('user_supplements').insert(DEFAULT_SUPPS.map((s, i) => ({ ...s, user_id: userId, sort_order: i })))
  }
}
