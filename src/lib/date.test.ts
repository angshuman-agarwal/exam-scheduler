import { describe, it, expect } from 'vitest'
import { getLocalDayKey, msUntilNextLocalMidnight } from './date'

describe('getLocalDayKey', () => {
  it('formats a standard date', () => {
    const date = new Date(2026, 2, 15) // March 15, 2026
    expect(getLocalDayKey(date)).toBe('2026-03-15')
  })

  it('pads single-digit month and day', () => {
    const date = new Date(2026, 0, 5) // Jan 5, 2026
    expect(getLocalDayKey(date)).toBe('2026-01-05')
  })

  it('handles midnight edge', () => {
    const date = new Date(2026, 11, 31, 23, 59, 59) // Dec 31, 2026 23:59:59
    expect(getLocalDayKey(date)).toBe('2026-12-31')
  })

  it('handles first day of year', () => {
    const date = new Date(2026, 0, 1, 0, 0, 0)
    expect(getLocalDayKey(date)).toBe('2026-01-01')
  })
})

describe('msUntilNextLocalMidnight', () => {
  it('returns the remaining milliseconds until the next local midnight', () => {
    const date = new Date(2026, 2, 31, 23, 59, 30, 0)
    expect(msUntilNextLocalMidnight(date)).toBe(30000)
  })

  it('returns a full day at local midnight', () => {
    const date = new Date(2026, 2, 31, 0, 0, 0, 0)
    expect(msUntilNextLocalMidnight(date)).toBe(24 * 60 * 60 * 1000)
  })
})
