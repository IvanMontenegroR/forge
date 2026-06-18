// ============================================================
// Hooks de React Query sobre src/data/db.js
// ============================================================
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { todayStr, weekStart, addDays } from '../lib/dates'
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
  supplements: (u) => ['supplements', u],
  supLogs: (u, d) => ['supLogs', u, d],
  sleep: (u) => ['sleep', u],
  cardio: (u) => ['cardio', u],
  steps: (u, d) => ['steps', u, d],
  streaks: (u) => ['streaks', u],
  badges: () => ['badges'],
  userBadges: (u) => ['userBadges', u],
  quests: (u) => ['quests', u],
  xp: (u) => ['xp', u],
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
export function useStreaks() {
  const u = useUid()
  return useQuery({ queryKey: qk.streaks(u), queryFn: () => db.getStreaks(u), enabled: !!u })
}
export function useBadges() {
  return useQuery({ queryKey: qk.badges(), queryFn: db.listBadges })
}
export function useUserBadges() {
  const u = useUid()
  return useQuery({ queryKey: qk.userBadges(u), queryFn: () => db.listUserBadges(u), enabled: !!u })
}
export function useWeeklyQuests() {
  const u = useUid()
  return useQuery({ queryKey: qk.quests(u), queryFn: () => db.getWeeklyQuests(u, weekStart()), enabled: !!u })
}
export function useXpEvents() {
  const u = useUid()
  return useQuery({ queryKey: qk.xp(u), queryFn: () => db.getXpEvents(u), enabled: !!u })
}
