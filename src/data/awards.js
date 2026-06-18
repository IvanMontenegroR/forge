// ============================================================
// useAwards — punto único para otorgar XP y badges con feedback.
// Aplica el multiplicador de muscle memory, deduplica por día y
// mantiene profile.xp sincronizado. Las pantallas llaman a esto.
// ============================================================
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { todayStr, weekStart } from '../lib/dates'
import { muscleMemoryState } from '../lib/gamification'
import * as db from './db'
import { qk } from './hooks'

export function useAwards() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()

  async function currentMultiplier() {
    const profile = qc.getQueryData(qk.profile(user.id)) || (await db.getProfile(user.id))
    const mm = muscleMemoryState(profile?.muscle_memory_start, profile?.muscle_memory_days, todayStr())
    return mm.multiplier
  }

  // Otorga XP. opts.oncePerDay evita duplicar el mismo tipo en el día.
  async function award(type, baseXp, description, opts = {}) {
    if (!user) return 0
    const refDate = opts.refDate || todayStr()
    if (opts.oncePerDay) {
      const exists = await db.hasXpEvent(user.id, type, refDate)
      if (exists) return 0
    }
    const mult = opts.noMultiplier ? 1 : await currentMultiplier()
    const xp = Math.round(baseXp * mult)
    await db.addXpEvent(user.id, { type, xp, multiplier: mult, description, refDate })
    await db.bumpProfileXp(user.id, xp)
    qc.invalidateQueries({ queryKey: qk.profile(user.id) })
    qc.invalidateQueries({ queryKey: qk.xp(user.id) })
    toast.xp(xp, mult > 1 ? `${description} · x${mult} muscle memory` : description)
    return xp
  }

  // Desbloquea un badge por código (si no lo tenía) y suma su XP.
  async function grantBadge(code) {
    if (!user) return false
    const catalog = qc.getQueryData(qk.badges()) || (await db.listBadges())
    const badge = catalog.find((b) => b.code === code)
    if (!badge) return false
    const owned = (qc.getQueryData(qk.userBadges(user.id)) || []).some((ub) => ub.badge_id === badge.id || ub.badge?.code === code)
    if (owned) return false
    const res = await db.awardBadge(user.id, badge.id)
    if (!res) return false // ya lo tenía (carrera)
    if (badge.xp_reward > 0) {
      await db.addXpEvent(user.id, { type: 'badge', xp: badge.xp_reward, description: badge.name })
      await db.bumpProfileXp(user.id, badge.xp_reward)
    }
    qc.invalidateQueries({ queryKey: qk.userBadges(user.id) })
    qc.invalidateQueries({ queryKey: qk.profile(user.id) })
    toast.badge(badge.name)
    return true
  }

  // Suma progreso a una misión semanal y otorga bonus al completarla.
  async function bumpQuest(code, amount = 1) {
    if (!user) return
    const week = weekStart()
    const quests = qc.getQueryData(qk.quests(user.id)) || (await db.getWeeklyQuests(user.id, week))
    const q = quests.find((x) => x.code === code)
    if (!q || q.completed) return
    const progress = Math.min(q.target, q.progress + amount)
    const completed = progress >= q.target
    await db.upsertQuests([{ ...q, progress, completed }])
    qc.invalidateQueries({ queryKey: qk.quests(user.id) })
    if (completed) {
      await db.addXpEvent(user.id, { type: 'quest', xp: q.xp_reward, description: `Misión: ${q.title}` })
      await db.bumpProfileXp(user.id, q.xp_reward)
      qc.invalidateQueries({ queryKey: qk.profile(user.id) })
      toast.success('¡Misión completada!', `${q.title} · +${q.xp_reward} XP`)
    }
  }

  return { award, grantBadge, bumpQuest, currentMultiplier }
}
