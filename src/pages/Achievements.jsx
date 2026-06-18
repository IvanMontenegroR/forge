import {
  Flame, Dumbbell, Trophy, Calendar, Star, TrendingUp, TrendingDown,
  Pill, Beef, Footprints, Moon, Sparkles, Medal, Lock, Zap, Award,
} from 'lucide-react'
import { useProfile, useBadges, useUserBadges, useWeeklyQuests, useStreaks, useXpEvents } from '../data/hooks'
import { levelFromXp, cumXpForLevel, muscleMemoryState } from '../lib/gamification'
import { todayStr } from '../lib/dates'
import { Card, Ring, ProgressBar, Spinner } from '../components/ui'

const ICONS = {
  flame: Flame, dumbbell: Dumbbell, trophy: Trophy, calendar: Calendar, star: Star,
  'trending-up': TrendingUp, 'trending-down': TrendingDown, pill: Pill, beef: Beef,
  footprints: Footprints, moon: Moon, sparkles: Sparkles, medal: Medal,
}

const STREAK_META = {
  workout: { label: 'Entreno', icon: Dumbbell, color: 'var(--accent)' },
  creatine: { label: 'Creatina', icon: Pill, color: 'var(--success)' },
  steps: { label: 'Pasos', icon: Footprints, color: 'var(--info)' },
  protein: { label: 'Proteína', icon: Beef, color: 'var(--danger)' },
}

export default function Achievements() {
  const { data: profile } = useProfile()
  const { data: catalog } = useBadges()
  const { data: earned } = useUserBadges()
  const { data: quests } = useWeeklyQuests()
  const { data: streaks } = useStreaks()
  const { data: xpEvents } = useXpEvents()

  if (!profile || !catalog) return <div className="page"><Spinner /></div>

  const lvl = levelFromXp(profile.xp || 0)
  const earnedIds = new Set((earned || []).map((b) => b.badge_id))
  const mm = muscleMemoryState(profile.muscle_memory_start, profile.muscle_memory_days, todayStr())

  return (
    <div className="page">
      <div className="page-head"><p className="eyebrow">Logros</p><h1>Tu progreso</h1></div>

      {/* Nivel */}
      <Card>
        <div className="row gap-16">
          <Ring progress={lvl.progress} size={84} stroke={9} color={lvl.rank.color}>
            <span style={{ fontSize: 24 }}>{lvl.level}</span>
          </Ring>
          <div className="col grow" style={{ gap: 4 }}>
            <strong style={{ fontSize: '1.2rem', color: lvl.rank.color }}>{lvl.rank.name}</strong>
            <span className="muted" style={{ fontSize: '0.85rem' }}>{(profile.xp || 0).toLocaleString('es')} XP totales</span>
            <span className="faint" style={{ fontSize: '0.8rem' }}>Faltan {lvl.toNext} XP para el nivel {lvl.level + 1}</span>
          </div>
        </div>
        <div className="bar xp mt-16"><span style={{ width: `${lvl.progress * 100}%` }} /></div>
        <div className="row between faint mt-8" style={{ fontSize: '0.72rem' }}>
          <span className="num">{cumXpForLevel(lvl.level)}</span>
          <span className="num">{cumXpForLevel(lvl.level + 1)}</span>
        </div>
      </Card>

      {/* Rachas */}
      <Card title="Rachas">
        <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
          {(streaks || []).sort((a, b) => a.kind.localeCompare(b.kind)).map((s) => {
            const m = STREAK_META[s.kind] || { label: s.kind, icon: Flame, color: 'var(--accent)' }
            const Icon = m.icon
            return (
              <div key={s.id} className="row gap-12" style={{ background: 'var(--bg-elev)', borderRadius: 12, padding: 12 }}>
                <Icon size={22} color={m.color} />
                <div className="col" style={{ gap: 0 }}>
                  <span className="num" style={{ fontSize: '1.3rem', fontWeight: 800, color: m.color }}>{s.current_count}</span>
                  <span className="faint" style={{ fontSize: '0.74rem' }}>{m.label} · récord {s.longest_count}</span>
                  {!s.freeze_available && <span className="faint" style={{ fontSize: '0.66rem' }}>perdón usado</span>}
                </div>
              </div>
            )
          })}
        </div>
        <p className="faint mt-12" style={{ fontSize: '0.76rem' }}>La racha de entreno cuenta días programados (mié/jue/sáb no la rompen). Cada racha tiene un &quot;perdón&quot;.</p>
      </Card>

      {/* Muscle memory */}
      {mm.active && (
        <Card>
          <div className="row between">
            <div className="row gap-8"><Zap size={18} color="var(--xp)" /><strong>Muscle Memory</strong></div>
            <span className="pill xp">x{mm.multiplier} · {mm.daysLeft} días</span>
          </div>
          <ProgressBar value={mm.total - mm.daysLeft} max={mm.total} variant="xp" />
        </Card>
      )}

      {/* Misiones */}
      {quests?.length > 0 && (
        <Card title="Misiones de la semana">
          <div className="col gap-12">
            {quests.map((q) => (
              <div key={q.id} className="col gap-4">
                <div className="row between">
                  <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{q.title}</span>
                  <span className="pill xp" style={{ fontSize: '0.7rem' }}>+{q.xp_reward}</span>
                </div>
                <ProgressBar value={q.progress} max={q.target} variant={q.completed ? 'success' : ''} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Badges */}
      <Card title={`Insignias (${earnedIds.size}/${catalog.length})`}>
        <div className="badge-grid">
          {catalog.map((b) => {
            const got = earnedIds.has(b.id)
            const Icon = ICONS[b.icon] || Award
            return (
              <div key={b.id} className="badge-cell" style={{ opacity: got ? 1 : 0.4 }} title={b.description}>
                <div className="badge-ico" style={{ background: got ? 'var(--accent-soft)' : 'var(--surface-2)', color: got ? 'var(--gold)' : 'var(--text-faint)' }}>
                  {got ? <Icon size={24} /> : <Lock size={20} />}
                </div>
                <strong style={{ fontSize: '0.74rem', textAlign: 'center' }}>{b.name}</strong>
                <span className="faint" style={{ fontSize: '0.66rem', textAlign: 'center' }}>{b.description}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* XP reciente */}
      {xpEvents?.length > 0 && (
        <Card title="XP reciente">
          <div className="col">
            {xpEvents.slice(0, 12).map((e) => (
              <div key={e.id} className="list-row">
                <span className="grow" style={{ fontSize: '0.86rem' }}>{e.description || e.type}</span>
                <span className="pill xp" style={{ fontSize: '0.72rem' }}>+{e.xp}{e.multiplier > 1 ? ` (x${e.multiplier})` : ''}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <style>{`
        .badge-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        .badge-cell { display: flex; flex-direction: column; align-items: center; gap: 5px; }
        .badge-ico { width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; }
      `}</style>
    </div>
  )
}
