import { describe, expect, it } from 'vitest'
import { getPageFromHash, getPageFromPath, getPathForPage, getPathFromHash, isAppPage } from './navigation'

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

  it('parses valid paths', () => {
    expect(getPageFromPath('/home')).toBe('home')
    expect(getPageFromPath('/today')).toBe('today')
    expect(getPageFromPath('/progress')).toBe('progress')
  })

  it('builds stable page paths from hashes and pages', () => {
    expect(getPathForPage('home')).toBe('/home')
    expect(getPathFromHash('#today')).toBe('/today')
    expect(getPathFromHash('#settings')).toBe('/home')
  })
})
