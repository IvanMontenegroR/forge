// ============================================================
// Hooks de React Query sobre src/data/db.js
// ============================================================
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { todayStr, weekStart, addDays } from '../lib/dates'
import { computeStreak } from '../lib/streaks'
import * as db from './db'

export const qk = {
  profile: (u) => ['profile', u],
  programs: () => ['programs'],
  programDays: (p) => ['programDays', p],
  exercises: () => ['exercises'],
  session: (u, d) => ['session', u, d],
  sessions: (u) => ['sessions', u],
  sessionSets: (s) => ['sessionSets', s],
  prevSets: (u, e, s) => ['prevSets', u, e, s],
  exHistory: (u, e) => ['exHistory', u, e],
  body: (u) => ['body', u],
  foods: (u) => ['foods', u],
  nutrition: (u, d) => ['nutrition', u, d],
  nutritionWeek: (u, w) => ['nutritionWeek', u, w],
  nutritionRange: (u, a, b) => ['nutritionRange', u, a, b],
  supplements: (u) => ['supplements', u],
  supLogs: (u, d) => ['supLogs', u, d],
  sleep: (u) => ['sleep', u],
  cardio: (u) => ['cardio', u],
  steps: (u, d) => ['steps', u, d],
  allowedEmails: () => ['allowedEmails'],
}

function useUid() {
  const { user } = useAuth()
  return user?.id
}

export function useProfile() {
  const u = useUid()
  return useQuery({ queryKey: qk.profile(u), queryFn: () => db.getProfile(u), enabled: !!u })
}
export function usePrograms() {
  return useQuery({ queryKey: qk.programs(), queryFn: db.listPrograms })
}
export function useProgramDays(programId) {
  return useQuery({ queryKey: qk.programDays(programId), queryFn: () => db.getProgramDays(programId), enabled: !!programId })
}
export function useExercises() {
  return useQuery({ queryKey: qk.exercises(), queryFn: db.listExercises })
}
export function useTodaySession() {
  const u = useUid(); const d = todayStr()
  return useQuery({ queryKey: qk.session(u, d), queryFn: () => db.getSessionByDate(u, d), enabled: !!u })
}
export function useSessions() {
  const u = useUid()
  return useQuery({ queryKey: qk.sessions(u), queryFn: () => db.listSessions(u), enabled: !!u })
}
export function useSessionSets(sessionId) {
  return useQuery({ queryKey: qk.sessionSets(sessionId), queryFn: () => db.getSessionSets(sessionId), enabled: !!sessionId })
}
export function usePrevSets(exerciseId, sessionId) {
  const u = useUid()
  return useQuery({
    queryKey: qk.prevSets(u, exerciseId, sessionId),
    queryFn: () => db.getPreviousSetsForExercise(u, exerciseId, sessionId),
    enabled: !!u && !!exerciseId,
  })
}
export function useExerciseHistory(exerciseId) {
  const u = useUid()
  return useQuery({ queryKey: qk.exHistory(u, exerciseId), queryFn: () => db.getExerciseHistory(u, exerciseId), enabled: !!u && !!exerciseId })
}
export function useBodyMetrics() {
  const u = useUid()
  return useQuery({ queryKey: qk.body(u), queryFn: () => db.listBodyMetrics(u), enabled: !!u })
}
export function useUserFoods() {
  const u = useUid()
  return useQuery({ queryKey: qk.foods(u), queryFn: () => db.listUserFoods(u), enabled: !!u })
}
export function useNutritionToday() {
  const u = useUid(); const d = todayStr()
  return useQuery({ queryKey: qk.nutrition(u, d), queryFn: () => db.getNutritionByDate(u, d), enabled: !!u })
}
// Registros de nutrición de una fecha específica (YYYY-MM-DD).
export function useNutritionByDate(date) {
  const u = useUid()
  return useQuery({ queryKey: qk.nutrition(u, date), queryFn: () => db.getNutritionByDate(u, date), enabled: !!u && !!date })
}
// Registros de nutrición en un rango arbitrario [from, to] (YYYY-MM-DD).
export function useNutritionRange(from, to) {
  const u = useUid()
  return useQuery({
    queryKey: qk.nutritionRange(u, from, to),
    queryFn: () => db.getNutritionRange(u, from, to),
    enabled: !!u && !!from && !!to,
  })
}
// Suma kcal y proteína de la semana actual (lun–dom).
export function useNutritionWeek() {
  const u = useUid(); const from = weekStart(); const to = addDays(from, 6)
  return useQuery({
    queryKey: qk.nutritionWeek(u, from),
    queryFn: async () => {
      const rows = await db.getNutritionRange(u, from, to)
      return rows.reduce((acc, n) => {
        const qty = Number(n.qty || 1)
        acc.kcal += Number(n.kcal || 0) * qty
        acc.protein_g += Number(n.protein_g || 0) * qty
        return acc
      }, { kcal: 0, protein_g: 0, from, to })
    },
    enabled: !!u,
  })
}
export function useSupplements() {
  const u = useUid()
  return useQuery({ queryKey: qk.supplements(u), queryFn: () => db.listSupplements(u), enabled: !!u })
}
export function useSupplementLogs() {
  const u = useUid(); const d = todayStr()
  return useQuery({ queryKey: qk.supLogs(u, d), queryFn: () => db.getSupplementLogs(u, d), enabled: !!u })
}
export function useSleep() {
  const u = useUid()
  return useQuery({ queryKey: qk.sleep(u), queryFn: () => db.listSleep(u), enabled: !!u })
}
export function useCardio() {
  const u = useUid()
  return useQuery({ queryKey: qk.cardio(u), queryFn: () => db.listCardio(u), enabled: !!u })
}
export function useStepsToday() {
  const u = useUid(); const d = todayStr()
  return useQuery({ queryKey: qk.steps(u, d), queryFn: () => db.getStepsByDate(u, d), enabled: !!u })
}
// ---------- Admin ----------
export function useAllowedEmails(enabled = true) {
  return useQuery({ queryKey: qk.allowedEmails(), queryFn: db.listAllowedEmails, enabled })
}

// ---------- Rachas (calculadas al vuelo) ----------
// Racha de nutrición: un día cuenta si el total de kcal quedó ≤ objetivo.
export function useNutritionStreak() {
  const { data: profile } = useProfile()
  const today = todayStr()
  const from = addDays(today, -120)
  const { data: rows } = useNutritionRange(from, today)
  const goal = profile?.target_kcal || 2050
  return useMemo(() => {
    if (!rows || !profile) return { current: 0, longest: 0, days: [] }
    const kcalByDay = new Map()
    for (const n of rows) {
      const qty = Number(n.qty || 1)
      kcalByDay.set(n.date, (kcalByDay.get(n.date) || 0) + Number(n.kcal || 0) * qty)
    }
    const evalForDate = (d) => {
      if (!kcalByDay.has(d)) return 'skip'
      return kcalByDay.get(d) <= goal ? 'good' : 'bad'
    }
    return computeStreak(evalForDate, { today })
  }, [rows, profile, goal, today])
}

// Racha de entreno por FRECUENCIA SEMANAL: una semana (lun–dom) "cuenta"
// si se completó la meta de entrenos. La racha son semanas seguidas cumplidas.
// La semana actual no rompe si todavía no llegó (está en curso).
export function useTrainingStreak() {
  const { data: profile } = useProfile()
  const { data: sessions } = useSessions()
  const today = todayStr()
  return useMemo(() => {
    const goal = profile?.weekly_workout_goal || 3
    if (!profile || !sessions) return { current: 0, longest: 0, goal, thisWeek: 0, weeks: [], unit: 'sem' }
    const byWeek = new Map()
    for (const s of sessions) {
      if (s.status !== 'completed') continue
      const w = weekStart(s.date)
      byWeek.set(w, (byWeek.get(w) || 0) + 1)
    }
    const cur = weekStart(today)
    const thisWeek = byWeek.get(cur) || 0

    // Racha actual: semana en curso si ya cumplió + semanas previas seguidas cumplidas.
    let current = thisWeek >= goal ? 1 : 0
    let w = addDays(cur, -7)
    while ((byWeek.get(w) || 0) >= goal) { current += 1; w = addDays(w, -7) }

    // Récord: recorrer de la primera semana con datos hasta la actual.
    const keys = [...byWeek.keys()].sort()
    let longest = 0, run = 0
    if (keys.length) {
      let ptr = keys[0]
      while (ptr <= cur) {
        if ((byWeek.get(ptr) || 0) >= goal) { run += 1; longest = Math.max(longest, run) }
        else if (ptr !== cur) { run = 0 } // la semana en curso incompleta no corta el récord
        ptr = addDays(ptr, 7)
      }
    }
    longest = Math.max(longest, current)

    // Últimas 6 semanas para el detalle.
    const weeks = []
    let ws = cur
    for (let i = 0; i < 6; i++) { weeks.push({ weekStart: ws, count: byWeek.get(ws) || 0, met: (byWeek.get(ws) || 0) >= goal }); ws = addDays(ws, -7) }

    return { current, longest, goal, thisWeek, weeks, unit: 'sem' }
  }, [profile, sessions, today])
}
