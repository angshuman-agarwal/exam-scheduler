import { describe, it, expect } from 'vitest'
import {
  createSession,
  pauseTimer,
  resumeTimer,
  stopTimer,
  computeElapsedMs,
  handleHidden,
  handleReturn,
  isStale,
  GRACE_MS,
  TOPIC_STRICT_THRESHOLD_MS,
  PAPER_STRICT_THRESHOLD_MS,
  STALE_RUNNING_MS,
  STALE_STOPPED_MS,
  strictThresholdMsFor,
} from './timer'

const T0 = 1_000_000

function makeSession(overrides: Partial<ReturnType<typeof createSession>> = {}) {
  return { ...createSession('topic', 'topic-1', 'manual', T0, false), ...overrides }
}

describe('computeElapsedMs', () => {
  it('running: elapsed = now - startedAt', () => {
    const s = makeSession()
    expect(computeElapsedMs(s, T0 + 5000)).toBe(5000)
  })

  it('paused: subtracts current pause gap', () => {
    const s = pauseTimer(makeSession(), T0 + 3000)
    // At T0+5000, paused for 2000ms
    expect(computeElapsedMs(s, T0 + 5000)).toBe(3000)
  })

  it('multi-pause: accumulates all pause gaps', () => {
    let s = makeSession()
    s = pauseTimer(s, T0 + 2000)     // pause at +2s
    s = resumeTimer(s, T0 + 4000)    // resume at +4s (2s paused)
    s = pauseTimer(s, T0 + 6000)     // pause again at +6s
    s = resumeTimer(s, T0 + 7000)    // resume at +7s (1s paused)
    // total elapsed at +10s: 10s - 3s paused = 7s
    expect(computeElapsedMs(s, T0 + 10000)).toBe(7000)
  })
})

describe('handleReturn', () => {
  it('strict: interrupts past threshold', () => {
    let s = makeSession({ strictMode: true })
    s = handleHidden(s, T0 + 1000)
    const gap = TOPIC_STRICT_THRESHOLD_MS + 1000
    const { session, banner } = handleReturn(s, T0 + 1000 + gap)
    expect(session.mode).toBe('interrupted')
    expect(banner).toBe('interrupted')
    expect(session.hiddenAt).toBeNull()
  })

  it('strict: restores within threshold', () => {
    let s = makeSession({ strictMode: true })
    s = handleHidden(s, T0 + 1000)
    const gap = TOPIC_STRICT_THRESHOLD_MS - 1000
    const { session, banner } = handleReturn(s, T0 + 1000 + gap)
    expect(session.mode).toBe('running')
    expect(banner).toBe('restored')
  })

  it('normal: auto-pauses past grace', () => {
    let s = makeSession({ strictMode: false })
    s = handleHidden(s, T0 + 1000)
    const gap = GRACE_MS + 2000
    const { session, banner } = handleReturn(s, T0 + 1000 + gap)
    expect(session.mode).toBe('paused')
    expect(banner).toBe('paused-away')
    expect(session.pausedAccumMs).toBe(gap)
  })

  it('brief restore within grace (both modes)', () => {
    let s = makeSession({ strictMode: false })
    s = handleHidden(s, T0 + 1000)
    const gap = GRACE_MS - 500
    const { session, banner } = handleReturn(s, T0 + 1000 + gap)
    expect(session.mode).toBe('running')
    expect(banner).toBe('restored')
  })

  it('already paused: handleHidden is no-op', () => {
    let s = pauseTimer(makeSession(), T0 + 1000)
    const before = { ...s }
    s = handleHidden(s, T0 + 2000)
    expect(s).toEqual(before) // no change — mode is paused, not running
  })
})

describe('handleHidden idempotency', () => {
  it('calling twice does not overwrite hiddenAt', () => {
    let s = makeSession()
    s = handleHidden(s, T0 + 1000)
    expect(s.hiddenAt).toBe(T0 + 1000)
    s = handleHidden(s, T0 + 2000)
    expect(s.hiddenAt).toBe(T0 + 1000) // unchanged
  })
})

describe('handleReturn idempotency', () => {
  it('no-op when hiddenAt is null', () => {
    const s = makeSession()
    const { session, banner } = handleReturn(s, T0 + 5000)
    expect(session).toEqual(s)
    expect(banner).toBeNull()
  })
})

describe('pause/resume guard clauses', () => {
  it('pause is no-op when not running', () => {
    const s = pauseTimer(makeSession(), T0 + 1000)
    const again = pauseTimer(s, T0 + 2000)
    expect(again.pausedAt).toBe(T0 + 1000) // unchanged
  })

  it('resume is no-op when not paused', () => {
    const s = makeSession()
    const again = resumeTimer(s, T0 + 1000)
    expect(again).toEqual(s)
  })
})

describe('stopTimer', () => {
  it('from running', () => {
    const s = stopTimer(makeSession(), T0 + 5000)
    expect(s.mode).toBe('stopped')
    expect(s.pausedAt).toBeNull()
  })

  it('from paused: folds final pause gap', () => {
    let s = pauseTimer(makeSession(), T0 + 3000)
    s = stopTimer(s, T0 + 6000)
    expect(s.mode).toBe('stopped')
    expect(s.pausedAccumMs).toBe(3000) // 3s pause gap folded
    expect(s.pausedAt).toBeNull()
  })
})

describe('isStale', () => {
  it('running >4hrs is stale', () => {
    const s = makeSession()
    expect(isStale(s, T0 + STALE_RUNNING_MS + 1)).toBe(true)
  })

  it('running <=4hrs is not stale', () => {
    const s = makeSession()
    expect(isStale(s, T0 + STALE_RUNNING_MS - 1)).toBe(false)
  })

  it('paused >4hrs is stale', () => {
    const s = pauseTimer(makeSession(), T0 + 1000)
    expect(isStale(s, T0 + STALE_RUNNING_MS + 1)).toBe(true)
  })

  it('stopped >30min is stale', () => {
    const s = stopTimer(makeSession(), T0 + 5000)
    expect(isStale(s, T0 + 5000 + STALE_STOPPED_MS + 1)).toBe(true)
  })

  it('stopped <=30min is not stale', () => {
    const s = stopTimer(makeSession(), T0 + 5000)
    expect(isStale(s, T0 + 5000 + STALE_STOPPED_MS - 1)).toBe(false)
  })

  it('interrupted >30min is stale', () => {
    let s = makeSession({ strictMode: true })
    s = handleHidden(s, T0 + 1000)
    const { session } = handleReturn(s, T0 + 1000 + TOPIC_STRICT_THRESHOLD_MS + 1000)
    expect(session.mode).toBe('interrupted')
    expect(isStale(session, session.modeChangedAt + STALE_STOPPED_MS + 1)).toBe(true)
  })
})

describe('strictThresholdMsFor', () => {
  it('uses a longer threshold for paper sessions', () => {
    expect(strictThresholdMsFor(makeSession())).toBe(TOPIC_STRICT_THRESHOLD_MS)
    expect(strictThresholdMsFor(makeSession({ targetType: 'paper', targetId: 'paper-1' }))).toBe(PAPER_STRICT_THRESHOLD_MS)
  })
})

describe('modeChangedAt', () => {
  it('stamped on creation', () => {
    const s = createSession('topic', 't', 'manual', T0, false)
    expect(s.modeChangedAt).toBe(T0)
  })

  it('stamped on pause', () => {
    const s = pauseTimer(makeSession(), T0 + 1000)
    expect(s.modeChangedAt).toBe(T0 + 1000)
  })

  it('stamped on resume', () => {
    let s = pauseTimer(makeSession(), T0 + 1000)
    s = resumeTimer(s, T0 + 3000)
    expect(s.modeChangedAt).toBe(T0 + 3000)
  })

  it('stamped on stop', () => {
    const s = stopTimer(makeSession(), T0 + 5000)
    expect(s.modeChangedAt).toBe(T0 + 5000)
  })
})
