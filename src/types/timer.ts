import type { PaperAttemptSource, ScheduleSource } from './index'

export type TimerMode = 'running' | 'paused' | 'stopped' | 'interrupted'
export type TimerBanner = 'paused-away' | 'interrupted' | 'restored' | null
export type TimerTargetType = 'topic' | 'paper'

export interface TimerTarget {
  targetType: TimerTargetType
  targetId: string
}

export interface TimerSession extends TimerTarget {
  sessionId: string
  source: ScheduleSource | PaperAttemptSource
  scheduleItemId?: string
  mode: TimerMode
  startedAt: number       // epoch ms
  pausedAt: number | null  // epoch ms when paused
  pausedAccumMs: number    // total ms spent paused
  hiddenAt: number | null  // epoch ms when page became hidden
  strictMode: boolean
  modeChangedAt: number    // epoch ms, stamped on every mode transition
}

export interface TimerSettings {
  strictModeDefault: boolean
  wakeLockEnabled: boolean
}
