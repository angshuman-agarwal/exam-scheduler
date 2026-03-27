import { describe, expect, it } from 'vitest'
import { getPageFromHash, isAppPage } from './navigation'

describe('navigation', () => {
  it('recognizes valid app pages', () => {
    expect(isAppPage('home')).toBe(true)
    expect(isAppPage('today')).toBe(true)
    expect(isAppPage('progress')).toBe(true)
  })

  it('rejects invalid app pages', () => {
    expect(isAppPage('settings')).toBe(false)
    expect(isAppPage('')).toBe(false)
  })

  it('parses valid hashes', () => {
    expect(getPageFromHash('#home')).toBe('home')
    expect(getPageFromHash('#today')).toBe('today')
    expect(getPageFromHash('#progress')).toBe('progress')
  })

  it('falls back to home for invalid hashes', () => {
    expect(getPageFromHash('#settings')).toBe('home')
    expect(getPageFromHash('settings')).toBe('home')
    expect(getPageFromHash('')).toBe('home')
  })
})
