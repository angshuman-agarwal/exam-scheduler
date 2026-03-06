import { create } from 'zustand'
import type { TimerSession, TimerBanner, TimerSettings } from '../types/timer'
import type { ScheduleSource } from '../types'
import { loadFromIdbRaw, saveToIdbRaw } from '../lib/idb'
import {
  createSession,
  pauseTimer,
  resumeTimer,
  stopTimer,
  computeElapsedMs,
  handleHidden,
  handleReturn,
  isStale,
} from '../lib/timer'

const TIMER_KEY = 'timer'

interface PersistedTimer {
  session: TimerSession | null
  settings: TimerSettings
}

interface TimerState {
  session: TimerSession | null
  settings: TimerSettings
  banner: TimerBanner

  initTimer: () => Promise<void>
  start: (topicId: string, source: ScheduleSource, scheduleItemId?: string) => void
  pause: () => void
  resume: () => void
  stop: () => void
  discard: () => void
  onHidden: () => void
  onVisible: () => void
  dismissBanner: () => void
  getElapsedMs: () => number
  updateSettings: (patch: Partial<TimerSettings>) => void
}

const DEFAULT_SETTINGS: TimerSettings = {
  strictModeDefault: false,
  wakeLockEnabled: false,
}

function persist(session: TimerSession | null, settings: TimerSettings) {
  saveToIdbRaw<PersistedTimer>(TIMER_KEY, { session, settings })
}

export const useTimerStore = create<TimerState>()((set, get) => ({
  session: null,
  settings: DEFAULT_SETTINGS,
  banner: null,

  initTimer: async () => {
    const data = await loadFromIdbRaw<PersistedTimer>(TIMER_KEY)
    if (!data) return

    const settings = data.settings ?? DEFAULT_SETTINGS
    let session = data.session

    if (session) {
      const now = Date.now()
      if (isStale(session, now)) {
        session = null
      } else if (session.mode === 'running' || session.mode === 'paused') {
        if (session.hiddenAt != null) {
          // App was hidden via visibilitychange before closing — reconcile normally
          const result = handleReturn(session, now)
          session = result.session
        } else if (session.mode === 'running') {
          // Cold recovery: was running with no hiddenAt (browser killed, crash, etc.)
          // We don't know when the app actually closed, so auto-pause at current time
          // to preserve the elapsed time accumulated before the close.
          session = pauseTimer(session, now)
        }
        // Check stale again after reconciliation
        if (isStale(session, now)) {
          session = null
        }
      }
      // stopped/interrupted: preserve as-is (stale check already done above)
    }

    set({ session, settings, banner: null })
    persist(session, settings)
  },

  start: (topicId, source, scheduleItemId) => {
    const { settings } = get()
    const now = Date.now()
    const session = createSession(topicId, source, now, settings.strictModeDefault, scheduleItemId)
    set({ session, banner: null })
    persist(session, settings)
  },

  pause: () => {
    const { session, settings } = get()
    if (!session) return
    const updated = pauseTimer(session, Date.now())
    set({ session: updated })
    persist(updated, settings)
  },

  resume: () => {
    const { session, settings } = get()
    if (!session) return
    const updated = resumeTimer(session, Date.now())
    set({ session: updated, banner: null })
    persist(updated, settings)
  },

  stop: () => {
    const { session, settings } = get()
    if (!session) return
    const updated = stopTimer(session, Date.now())
    set({ session: updated, banner: null })
    persist(updated, settings)
  },

  discard: () => {
    const { settings } = get()
    set({ session: null, banner: null })
    persist(null, settings)
  },

  onHidden: () => {
    const { session, settings } = get()
    if (!session) return
    const updated = handleHidden(session, Date.now())
    if (updated !== session) {
      set({ session: updated })
      persist(updated, settings)
    }
  },

  onVisible: () => {
    const { session, settings } = get()
    if (!session || session.hiddenAt == null) return
    const now = Date.now()
    // Stale check first
    if (isStale(session, now)) {
      set({ session: null, banner: null })
      persist(null, settings)
      return
    }
    const result = handleReturn(session, now)
    set({ session: result.session, banner: result.banner })
    persist(result.session, settings)
  },

  dismissBanner: () => set({ banner: null }),

  getElapsedMs: () => {
    const { session } = get()
    if (!session) return 0
    return computeElapsedMs(session, Date.now())
  },

  updateSettings: (patch) => {
    const { session, settings } = get()
    const updated = { ...settings, ...patch }
    set({ settings: updated })
    persist(session, updated)
  },
}))
