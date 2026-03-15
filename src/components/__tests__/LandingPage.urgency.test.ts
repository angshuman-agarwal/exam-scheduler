import { describe, it, expect } from 'vitest'
import { homeUrgencyTone } from '../../lib/homeUrgency'

describe('homeUrgencyTone', () => {
  it.each([
    { days: 60, label: 'On track', colorKey: 'blue' },
    { days: 30, label: 'On track', colorKey: 'blue' },
    { days: 29, label: 'Getting close', colorKey: 'amber' },
    { days: 14, label: 'Getting close', colorKey: 'amber' },
    { days: 13, label: 'Final stretch', colorKey: 'orange' },
  ])('days=$days → "$label" ($colorKey)', ({ days, label, colorKey }) => {
    const tone = homeUrgencyTone(days)
    expect(tone.label).toBe(label)
    expect(tone.bg).toContain(colorKey)
    expect(tone.text).toContain(colorKey)
  })
})
