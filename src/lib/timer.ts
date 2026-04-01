import type { TimerSession, TimerBanner, TimerMode, TimerTargetType } from '../types/timer'
import type { PaperAttemptSource, ScheduleSource } from '../types'

// Constants
export const TOPIC_STRICT_THRESHOLD_MS = 15_000
export const PAPER_STRICT_THRESHOLD_MS = 60_000
export const GRACE_MS = 3_000
export const STALE_RUNNING_MS = 4 * 60 * 60 * 1000  // 4 hours
export const STALE_STOPPED_MS = 30 * 60 * 1000       // 30 minutes

export function createSession(
  targetType: TimerTargetType,
  targetId: string,
  source: ScheduleSource | PaperAttemptSource,
  now: number,
  strictMode: boolean,
  scheduleItemId?: string,
): TimerSession {
  return {
    sessionId: `ts-${now}-${Math.random().toString(36).slice(2, 8)}`,
    targetType,
    targetId,
    source,
    scheduleItemId,
    mode: 'running',
    startedAt: now,
    pausedAt: null,
    pausedAccumMs: 0,
    hiddenAt: null,
    strictMode,
    modeChangedAt: now,
  }
}

export function strictThresholdMsFor(session: Pick<TimerSession, 'targetType'>): number {
  return session.targetType === 'paper' ? PAPER_STRICT_THRESHOLD_MS : TOPIC_STRICT_THRESHOLD_MS
}

export function pauseTimer(session: TimerSession, now: number): TimerSession {
  if (session.mode !== 'running') return session
  return { ...session, mode: 'paused', pausedAt: now, modeChangedAt: now }
}

export function resumeTimer(session: TimerSession, now: number): TimerSession {
  if (session.mode !== 'paused' || session.pausedAt == null) return session
  const pauseGap = now - session.pausedAt
  return {
    ...session,
    mode: 'running',
    pausedAt: null,
    pausedAccumMs: session.pausedAccumMs + pauseGap,
    modeChangedAt: now,
  }
}

export function stopTimer(session: TimerSession, now: number): TimerSession {
  if (session.mode !== 'running' && session.mode !== 'paused') return session
  // If paused, fold final pause gap before stopping
  let finalAccum = session.pausedAccumMs
  if (session.mode === 'paused' && session.pausedAt != null) {
    finalAccum += now - session.pausedAt
  }
  return {
    ...session,
    mode: 'stopped',
    pausedAt: null,
    pausedAccumMs: finalAccum,
    modeChangedAt: now,
  }
}

export function computeElapsedMs(session: TimerSession, now: number): number {
  const total = now - session.startedAt
  let paused = session.pausedAccumMs
  if (session.mode === 'paused' && session.pausedAt != null) {
    paused += now - session.pausedAt
  }
  return Math.max(0, total - paused)
}

export function handleHidden(session: TimerSession, now: number): TimerSession {
  if (session.mode !== 'running' || session.hiddenAt != null) return session
  return { ...session, hiddenAt: now }
}

interface HandleReturnResult {
  session: TimerSession
  banner: TimerBanner
}

export function handleReturn(session: TimerSession, now: number): HandleReturnResult {
  if (session.hiddenAt == null) {
    return { session, banner: null }
  }

  const gap = now - session.hiddenAt

  // Within grace period — both strict and normal keep running
  if (gap <= GRACE_MS) {
    return {
      session: { ...session, hiddenAt: null },
      banner: 'restored',
    }
  }

  if (session.strictMode) {
    const strictThresholdMs = strictThresholdMsFor(session)
    // Strict: within extended threshold — still ok
    if (gap <= strictThresholdMs) {
      return {
        session: { ...session, hiddenAt: null },
        banner: 'restored',
      }
    }
    // Strict: past threshold — interrupt
    return {
      session: {
        ...session,
        mode: 'interrupted' as TimerMode,
        hiddenAt: null,
        modeChangedAt: now,
      },
      banner: 'interrupted',
    }
  }

  // Normal: past grace — auto-pause
  return {
    session: {
      ...session,
      mode: 'paused' as TimerMode,
      pausedAccumMs: session.pausedAccumMs + gap,
      pausedAt: now,
      hiddenAt: null,
      modeChangedAt: now,
    },
    banner: 'paused-away',
  }
}

export function isStale(session: TimerSession, now: number): boolean {
  if (session.mode === 'running' || session.mode === 'paused') {
    return now - session.startedAt > STALE_RUNNING_MS
  }
  // stopped or interrupted
  return now - session.modeChangedAt > STALE_STOPPED_MS
}
