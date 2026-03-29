import { describe, expect, it } from 'vitest'
import {
  buildAnalyticsMetrics,
  coveragePercent,
  freshnessRatio,
  masteryPercent,
  readinessPercent,
  studyVelocityBars,
  studyVelocityDeltaPercent,
} from './analytics'
import type { Session, Topic } from '../../types'

function topic(partial: Partial<Topic>): Topic {
  return {
    id: partial.id ?? 'topic-1',
    paperId: partial.paperId ?? 'paper-1',
    offeringId: partial.offeringId ?? 'offering-1',
    name: partial.name ?? 'Topic',
    confidence: partial.confidence ?? 3,
    performanceScore: partial.performanceScore ?? 0.5,
    lastReviewed: partial.lastReviewed ?? null,
  }
}

function session(partial: Partial<Session>): Session {
  return {
    id: partial.id ?? 'session-1',
    topicId: partial.topicId ?? 'topic-1',
    date: partial.date ?? '2026-04-15',
    score: partial.score ?? 0.6,
    durationSeconds: partial.durationSeconds,
    timestamp: partial.timestamp,
    source: partial.source,
  }
}

describe('progress analytics helpers', () => {
  it('calculates mastery percentage from performance and confidence', () => {
    expect(masteryPercent(topic({ performanceScore: 0.75, confidence: 4 }))).toBe(77)
    expect(masteryPercent(topic({ performanceScore: 0.4, confidence: 2 }))).toBe(40)
  })

  it('maps freshness ratio from live engine recency steps', () => {
    const today = new Date('2026-04-15T12:00:00')
    expect(freshnessRatio('2026-04-15', today)).toBe(1)
    expect(freshnessRatio('2026-04-14', today)).toBe(0.8)
    expect(freshnessRatio('2026-04-10', today)).toBe(0.65)
    expect(freshnessRatio('2026-04-06', today)).toBe(0.5)
    expect(freshnessRatio('2026-03-20', today)).toBe(0)
  })

  it('calculates coverage percent from reviewed topics', () => {
    const topics = [
      topic({ id: 't1', lastReviewed: '2026-04-15' }),
      topic({ id: 't2', lastReviewed: '2026-04-14' }),
      topic({ id: 't3', lastReviewed: null }),
      topic({ id: 't4', lastReviewed: null }),
    ]
    expect(coveragePercent(topics)).toBe(50)
  })

  it('calculates readiness using mastery, freshness, and coverage', () => {
    const today = new Date('2026-04-15T12:00:00')
    const topics = [
      topic({ id: 't1', performanceScore: 0.85, confidence: 4, lastReviewed: '2026-04-15' }),
      topic({ id: 't2', performanceScore: 0.75, confidence: 4, lastReviewed: '2026-04-12' }),
      topic({ id: 't3', performanceScore: 0.6, confidence: 3, lastReviewed: '2026-04-05' }),
    ]
    expect(readinessPercent(topics, today)).toBe(80)
  })

  it('calculates study velocity using duration when available', () => {
    const today = new Date('2026-04-15T12:00:00')
    const sessions = [
      session({ id: 'a', date: '2026-04-14', durationSeconds: 1800 }),
      session({ id: 'b', date: '2026-04-15', durationSeconds: 1800 }),
      session({ id: 'c', date: '2026-04-05', durationSeconds: 1200 }),
    ]
    expect(studyVelocityDeltaPercent(sessions, today)).toBe(200)
  })

  it('builds compact study velocity bars for the recent window', () => {
    const today = new Date('2026-04-15T12:00:00')
    const sessions = [
      session({ id: 'a', date: '2026-04-10', durationSeconds: 600 }),
      session({ id: 'b', date: '2026-04-12', durationSeconds: 1200 }),
      session({ id: 'c', date: '2026-04-14', durationSeconds: 1800 }),
      session({ id: 'd', date: '2026-04-15', durationSeconds: 2400 }),
    ]

    expect(studyVelocityBars(sessions, today)).toEqual([25, 18, 50, 18, 75, 100])
  })

  it('builds the four top-level analytics metrics', () => {
    const today = new Date('2026-04-15T12:00:00')
    const topics = [
      topic({ id: 't1', performanceScore: 0.85, confidence: 4, lastReviewed: '2026-04-15' }),
      topic({ id: 't2', performanceScore: 0.75, confidence: 4, lastReviewed: '2026-04-12' }),
      topic({ id: 't3', performanceScore: 0.6, confidence: 3, lastReviewed: null }),
    ]
    const sessions = [
      session({ id: 'a', date: '2026-04-14', durationSeconds: 1800 }),
      session({ id: 'b', date: '2026-04-15', durationSeconds: 1800 }),
      session({ id: 'c', date: '2026-04-05', durationSeconds: 1200 }),
    ]

    expect(buildAnalyticsMetrics(topics, sessions, today)).toEqual([
      expect.objectContaining({ label: 'Mastery', value: '74%' }),
      expect.objectContaining({ label: 'Exam Readiness', value: '69%' }),
      expect.objectContaining({ label: 'Coverage', value: '67%' }),
      expect.objectContaining({ label: 'Study Velocity', value: '+200%', trendBars: [18, 18, 18, 18, 100, 100] }),
    ])
  })
})
