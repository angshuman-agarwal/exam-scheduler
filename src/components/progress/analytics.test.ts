import { describe, expect, it } from 'vitest'
import {
  buildAnalyticsMetrics,
  buildStudyVelocitySeries,
  coveragePercent,
  freshnessRatio,
  masteryPercent,
  readinessPercent,
  studyVelocityBars,
  studyVelocityDeltaPercent,
} from './analytics'
import type { Offering, Session, Subject, Topic } from '../../types'

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

function offering(partial: Partial<Offering>): Offering {
  return {
    id: partial.id ?? 'offering-1',
    subjectId: partial.subjectId ?? 'subject-1',
    boardId: partial.boardId ?? 'aqa',
    spec: partial.spec ?? '8525',
    label: partial.label ?? 'AQA 8525',
    qualificationId: partial.qualificationId ?? 'gcse',
  }
}

function subject(partial: Partial<Subject>): Subject {
  return {
    id: partial.id ?? 'subject-1',
    name: partial.name ?? 'Computer Science',
    color: partial.color ?? '#2563eb',
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

  it('builds a 14-day interactive study velocity series with real units', () => {
    const today = new Date('2026-04-15T12:00:00')
    const sessions = [
      session({ id: 'a', date: '2026-04-02', durationSeconds: 1200 }),
      session({ id: 'b', date: '2026-04-10', durationSeconds: 600 }),
      session({ id: 'c', date: '2026-04-12', durationSeconds: 1200 }),
      session({ id: 'd', date: '2026-04-14', durationSeconds: 1800 }),
      session({ id: 'e', date: '2026-04-15', durationSeconds: 2400 }),
    ]

    const series = buildStudyVelocitySeries(sessions, today)
    expect(series.unitLabel).toBe('Minutes studied')
    expect(series.points).toHaveLength(14)
    expect(series.points[0]).toEqual(expect.objectContaining({ dateKey: '2026-04-02', value: 20 }))
    expect(series.points.at(-1)).toEqual(expect.objectContaining({ dateKey: '2026-04-15', value: 40, heightPercent: 100 }))
  })

  it('builds stacked subject segments for velocity bars when study spans multiple subjects', () => {
    const today = new Date('2026-04-15T12:00:00')
    const topics = [
      topic({ id: 'cs-topic', offeringId: 'cs-offering' }),
      topic({ id: 'bio-topic', offeringId: 'bio-offering' }),
    ]
    const offerings = [
      offering({ id: 'cs-offering', subjectId: 'cs-subject' }),
      offering({ id: 'bio-offering', subjectId: 'bio-subject' }),
    ]
    const subjects = [
      subject({ id: 'cs-subject', name: 'Computer Science', color: '#2563eb' }),
      subject({ id: 'bio-subject', name: 'Biology', color: '#10b981' }),
    ]
    const sessions = [
      session({ id: 'a', topicId: 'cs-topic', date: '2026-04-15', durationSeconds: 1200 }),
      session({ id: 'b', topicId: 'bio-topic', date: '2026-04-15', durationSeconds: 1800 }),
    ]

    const series = buildStudyVelocitySeries(sessions, today, 14, topics, offerings, subjects)
    const selectedPoint = series.points.at(-1)

    expect(selectedPoint).toEqual(
      expect.objectContaining({
        dateKey: '2026-04-15',
        value: 50,
      }),
    )
    expect(selectedPoint?.segments).toEqual([
      expect.objectContaining({ subjectId: 'bio-subject', subjectName: 'Biology', color: '#10b981', value: 30 }),
      expect.objectContaining({ subjectId: 'cs-subject', subjectName: 'Computer Science', color: '#2563eb', value: 20 }),
    ])
    expect(Math.round((selectedPoint?.segments[0]?.sharePercent ?? 0) + (selectedPoint?.segments[1]?.sharePercent ?? 0))).toBe(100)
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
