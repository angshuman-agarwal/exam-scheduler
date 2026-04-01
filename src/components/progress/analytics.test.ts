import { describe, expect, it } from 'vitest'
import {
  buildAnalyticsMetrics,
  buildLastSessionSummary,
  buildProgressCalendarDayMeta,
  buildProgressTableRows,
  buildTopicTableRows,
  buildStudyVelocitySeries,
  coveragePercent,
  freshnessRatio,
  recencyLabel,
  masteryPercent,
  readinessPercent,
  studyVelocityBars,
  studyVelocityDeltaPercent,
} from './analytics'
import type { Note, Offering, PaperAttempt, Session, Subject, Topic } from '../../types'

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

function paperAttempt(partial: Partial<PaperAttempt>): PaperAttempt {
  return {
    id: partial.id ?? 'paper-attempt-1',
    paperId: partial.paperId ?? 'paper-1',
    date: partial.date ?? '2026-04-15',
    timestamp: partial.timestamp ?? new Date('2026-04-15T18:00:00').getTime(),
    durationSeconds: partial.durationSeconds ?? 5400,
    confidence: partial.confidence ?? 3,
    rawMark: partial.rawMark,
    totalMarks: partial.totalMarks,
    noteText: partial.noteText,
    taggedTopicIds: partial.taggedTopicIds,
    source: partial.source ?? 'calendar',
  }
}

function subject(partial: Partial<Subject>): Subject {
  return {
    id: partial.id ?? 'subject-1',
    name: partial.name ?? 'Computer Science',
    color: partial.color ?? '#2563eb',
  }
}

function note(partial: Partial<Note>): Note {
  return {
    id: partial.id ?? 'note-1',
    topicId: partial.topicId ?? 'topic-1',
    date: partial.date ?? '2026-04-15',
    text: partial.text ?? 'Revisit this topic',
  }
}

function paper(partial: { id?: string; offeringId?: string; name?: string; examDate?: string }) {
  return {
    id: partial.id ?? 'paper-1',
    offeringId: partial.offeringId ?? 'offering-1',
    name: partial.name ?? 'Paper 1',
    examDate: partial.examDate ?? '2026-05-20',
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

  it('calculates recency labels using calendar days across DST changes', () => {
    const today = new Date('2026-03-31T11:41:00')
    expect(recencyLabel('2026-03-31', today)).toBe('Today')
    expect(recencyLabel('2026-03-30', today)).toBe('Yesterday')
    expect(recencyLabel('2026-03-29', today)).toBe('2 days ago')
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

  it('includes paper attempts in the shared progress rows for recently reviewed work', () => {
    const today = new Date('2026-04-15T12:00:00')
    const topics = [topic({ id: 'cs-topic', offeringId: 'cs-offering', paperId: 'cs-paper', lastReviewed: '2026-04-14' })]
    const offerings = [
      offering({ id: 'cs-offering', subjectId: 'cs-subject' }),
      offering({ id: 'geo-offering', subjectId: 'geo-subject' }),
    ]
    const subjects = [
      subject({ id: 'cs-subject', name: 'Computer Science' }),
      subject({ id: 'geo-subject', name: 'Geography', color: '#22c55e' }),
    ]
    const papers = [
      paper({ id: 'cs-paper', offeringId: 'cs-offering', name: 'Paper 1', examDate: '2026-05-20' }),
      paper({ id: 'geo-paper', offeringId: 'geo-offering', name: 'Paper 1', examDate: '2026-04-20' }),
    ]
    const rows = buildProgressTableRows(
      topics,
      offerings,
      subjects,
      papers,
      today,
      [session({ topicId: 'cs-topic', date: '2026-04-14', score: 0.7 })],
      [paperAttempt({ paperId: 'geo-paper', date: '2026-04-15', confidence: 3, rawMark: 47, totalMarks: 80 })],
    )

    expect(rows.some((row) => row.kind === 'paper' && row.subject.name === 'Geography' && row.paper.name === 'Paper 1')).toBe(true)
  })

  it('maps paper attempts to simple action labels based on confidence', () => {
    const today = new Date('2026-04-15T12:00:00')
    const offerings = [offering({ id: 'offering-1', subjectId: 'subject-1' })]
    const subjects = [subject({ id: 'subject-1', name: 'Computer Science' })]
    const papers = [paper({ id: 'paper-1', offeringId: 'offering-1', name: 'Paper 1', examDate: '2026-05-20' })]

    const rows = buildProgressTableRows(
      [],
      offerings,
      subjects,
      papers,
      today,
      [],
      [
        paperAttempt({ id: 'low', paperId: 'paper-1', date: '2026-04-13', confidence: 2, timestamp: new Date('2026-04-13T18:00:00').getTime() }),
        paperAttempt({ id: 'mid', paperId: 'paper-1', date: '2026-04-14', confidence: 3, timestamp: new Date('2026-04-14T19:00:00').getTime() }),
        paperAttempt({ id: 'high', paperId: 'paper-1', date: '2026-04-15', confidence: 4, timestamp: new Date('2026-04-15T20:00:00').getTime() }),
      ],
    ).filter((row) => row.kind === 'paper')

    const rowById = new Map(rows.map((row) => [row.attempt.id, row]))
    expect(rowById.get('low')).toEqual(expect.objectContaining({ actionLabel: 'Sit another paper', actionReason: null }))
    expect(rowById.get('mid')).toEqual(expect.objectContaining({ actionLabel: 'On track', actionReason: null }))
    expect(rowById.get('high')).toEqual(expect.objectContaining({ actionLabel: 'Keep sharp', actionReason: 'strong recent paper confidence' }))
  })

  it('collapses same-day attempts for the same paper into one progress row using the latest attempt state', () => {
    const today = new Date('2026-04-15T12:00:00')
    const offerings = [offering({ id: 'offering-1', subjectId: 'subject-1' })]
    const subjects = [subject({ id: 'subject-1', name: 'Computer Science' })]
    const papers = [paper({ id: 'paper-1', offeringId: 'offering-1', name: 'Paper 1', examDate: '2026-05-20' })]

    const rows = buildProgressTableRows(
      [],
      offerings,
      subjects,
      papers,
      today,
      [],
      [
        paperAttempt({ id: 'morning', paperId: 'paper-1', date: '2026-04-15', confidence: 2, timestamp: new Date('2026-04-15T10:00:00').getTime() }),
        paperAttempt({ id: 'afternoon', paperId: 'paper-1', date: '2026-04-15', confidence: 4, rawMark: 72, totalMarks: 80, timestamp: new Date('2026-04-15T16:00:00').getTime() }),
      ],
    ).filter((row) => row.kind === 'paper')

    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual(expect.objectContaining({
      attempt: expect.objectContaining({ id: 'afternoon' }),
      attemptCount: 2,
      confidence: 4,
      lastScorePercent: 90,
      actionLabel: 'Keep sharp',
    }))
  })

  it('sorts recently reviewed rows by latest timestamp, not just by day', () => {
    const today = new Date('2026-04-15T12:00:00')
    const offerings = [offering({ id: 'offering-1', subjectId: 'subject-1' })]
    const subjects = [subject({ id: 'subject-1', name: 'Computer Science' })]
    const papers = [paper({ id: 'paper-1', offeringId: 'offering-1', name: 'Paper 1', examDate: '2026-05-20' })]
    const topicRows = buildProgressTableRows(
      [topic({ id: 'topic-1', offeringId: 'offering-1', lastReviewed: '2026-04-15' })],
      offerings,
      subjects,
      papers,
      today,
      [session({ id: 'topic-session', topicId: 'topic-1', date: '2026-04-15', timestamp: new Date('2026-04-15T09:00:00').getTime() })],
      [paperAttempt({ id: 'paper-late', paperId: 'paper-1', date: '2026-04-15', timestamp: new Date('2026-04-15T18:00:00').getTime() })],
    )

    const sorted = topicRows
      .filter((row) => row.kind === 'paper' || row.topic.lastReviewed !== null)
      .sort((a, b) => {
        if (b.recencyTimestamp !== a.recencyTimestamp) return b.recencyTimestamp - a.recencyTimestamp
        const aName = a.kind === 'paper' ? a.paper.name : a.topic.name
        const bName = b.kind === 'paper' ? b.paper.name : b.topic.name
        return aName.localeCompare(bName)
      })

    expect(sorted[0]).toEqual(expect.objectContaining({ kind: 'paper' }))
  })

  it('adds latest session context and classifies session trend for topic rows', () => {
    const today = new Date('2026-04-15T12:00:00')
    const topics = [
      topic({ id: 'up-topic', offeringId: 'offering-1', performanceScore: 0.5, confidence: 3, lastReviewed: '2026-04-15' }),
      topic({ id: 'flat-topic', offeringId: 'offering-1', performanceScore: 0.5, confidence: 3, lastReviewed: '2026-04-14' }),
      topic({ id: 'down-topic', offeringId: 'offering-1', performanceScore: 0.8, confidence: 4, lastReviewed: '2026-04-13' }),
      topic({ id: 'no-session-topic', offeringId: 'offering-1', performanceScore: 0.65, confidence: 3, lastReviewed: null }),
    ]
    const offerings = [offering({ id: 'offering-1', subjectId: 'subject-1' })]
    const subjects = [subject({ id: 'subject-1' })]
    const papers = [{ id: 'paper-1', offeringId: 'offering-1', name: 'Paper 1', examDate: '2026-05-20' }]
    const sessions = [
      session({ id: 'up-old', topicId: 'up-topic', score: 0.4, timestamp: 1 }),
      session({ id: 'up-new', topicId: 'up-topic', score: 0.75, timestamp: 2 }),
      session({ id: 'flat-topic-session', topicId: 'flat-topic', score: 0.54, timestamp: 3 }),
      session({ id: 'down-topic-session', topicId: 'down-topic', score: 0.7, timestamp: 4 }),
    ]

    const rows = buildTopicTableRows(topics, offerings, subjects, papers, today, sessions)
    const rowByTopicId = new Map(rows.map((row) => [row.topic.id, row]))

    expect(rowByTopicId.get('up-topic')).toEqual(expect.objectContaining({ lastSessionScore: 0.75, sessionTrend: 'up' }))
    expect(rowByTopicId.get('flat-topic')).toEqual(expect.objectContaining({ lastSessionScore: 0.54, sessionTrend: 'flat' }))
    expect(rowByTopicId.get('down-topic')).toEqual(expect.objectContaining({ lastSessionScore: 0.7, sessionTrend: 'down' }))
    expect(rowByTopicId.get('no-session-topic')).toEqual(expect.objectContaining({ lastSessionScore: null, sessionTrend: null }))
  })

  it('surfaces the latest topic note preview on topic rows when notes exist', () => {
    const today = new Date('2026-04-15T12:00:00')
    const rows = buildProgressTableRows(
      [topic({ id: 'topic-1', offeringId: 'offering-1', lastReviewed: '2026-04-15' })],
      [offering({ id: 'offering-1', subjectId: 'subject-1' })],
      [subject({ id: 'subject-1' })],
      [paper({ id: 'paper-1', offeringId: 'offering-1', name: 'Paper 1', examDate: '2026-05-20' })],
      today,
      [session({ topicId: 'topic-1', date: '2026-04-15', score: 0.7 })],
      [],
      [
        note({ id: 'older-note', topicId: 'topic-1', date: '2026-04-14', text: 'Older revision reminder' }),
        note({ id: 'newer-note', topicId: 'topic-1', date: '2026-04-15', text: 'Focus on binary search edge cases before the exam.' }),
      ],
    ).filter((row) => row.kind === 'topic')

    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual(expect.objectContaining({
      notePreview: 'Focus on binary search edge cases before the exam.',
    }))
  })

  it('keeps buildTopicTableRows backward compatible when sessions are omitted', () => {
    const today = new Date('2026-04-15T12:00:00')
    const topics = [topic({ id: 'topic-1', offeringId: 'offering-1', performanceScore: 0.6, confidence: 3, lastReviewed: '2026-04-15' })]
    const offerings = [offering({ id: 'offering-1', subjectId: 'subject-1' })]
    const subjects = [subject({ id: 'subject-1' })]
    const papers = [{ id: 'paper-1', offeringId: 'offering-1', name: 'Paper 1', examDate: '2026-05-20' }]

    const rows = buildTopicTableRows(topics, offerings, subjects, papers, today)

    expect(rows).toEqual([
      expect.objectContaining({
        topic: expect.objectContaining({ id: 'topic-1' }),
        lastSessionScore: null,
        sessionTrend: null,
      }),
    ])
  })

  it('prefers the latest session date for recency labels when session history and lastReviewed diverge', () => {
    const today = new Date('2026-03-31T11:41:00')
    const topics = [
      topic({
        id: 'topic-1',
        offeringId: 'offering-1',
        paperId: 'paper-1',
        performanceScore: 0.7,
        confidence: 4,
        lastReviewed: '2026-03-30',
      }),
    ]
    const offerings = [offering({ id: 'offering-1', subjectId: 'subject-1' })]
    const subjects = [subject({ id: 'subject-1' })]
    const papers = [paper({ id: 'paper-1', offeringId: 'offering-1', examDate: '2026-05-20' })]
    const sessions = [
      session({ id: 'latest', topicId: 'topic-1', date: '2026-03-29', score: 0.75, timestamp: 1 }),
    ]

    const [row] = buildTopicTableRows(topics, offerings, subjects, papers, today, sessions)

    expect(row).toEqual(expect.objectContaining({
      recencyLabel: '2 days ago',
      lastSessionScore: 0.75,
    }))
  })

  it('maps internal statuses to student-facing action labels and reasons', () => {
    const today = new Date('2026-04-15T12:00:00')
    const topics = [
      topic({ id: 'not-started', paperId: 'paper-not-started', lastReviewed: null }),
      topic({ id: 'priority-now', paperId: 'paper-priority', performanceScore: 0.5, confidence: 2, lastReviewed: '2026-04-15' }),
      topic({ id: 'needs-focus', paperId: 'paper-needs-focus', performanceScore: 0.55, confidence: 2, lastReviewed: '2026-03-01' }),
      topic({ id: 'revision-ready', paperId: 'paper-revision-ready', performanceScore: 0.75, confidence: 4, lastReviewed: '2026-04-14' }),
      topic({ id: 'complete', paperId: 'paper-complete', performanceScore: 0.85, confidence: 4, lastReviewed: '2026-04-15' }),
      topic({ id: 'scheduled', paperId: 'paper-scheduled', performanceScore: 0.65, confidence: 3, lastReviewed: '2026-04-12' }),
    ]
    const offerings = [offering({ id: 'offering-1', subjectId: 'subject-1' })]
    const subjects = [subject({ id: 'subject-1' })]
    const papers = [
      paper({ id: 'paper-not-started', examDate: '2026-06-30' }),
      paper({ id: 'paper-priority', examDate: '2026-04-17' }),
      paper({ id: 'paper-needs-focus', examDate: '2026-06-30' }),
      paper({ id: 'paper-revision-ready', examDate: '2026-06-30' }),
      paper({ id: 'paper-complete', examDate: '2026-06-30' }),
      paper({ id: 'paper-scheduled', examDate: '2026-06-30' }),
    ]

    const rows = buildTopicTableRows(topics, offerings, subjects, papers, today)
    const rowByTopicId = new Map(rows.map((row) => [row.topic.id, row]))

    expect(rowByTopicId.get('not-started')).toEqual(expect.objectContaining({
      status: 'Not Started',
      actionLabel: 'Begin this topic',
      actionReason: 'not studied yet',
    }))
    expect(rowByTopicId.get('priority-now')).toEqual(expect.objectContaining({
      status: 'Priority Now',
      actionLabel: 'Study today',
      actionReason: 'exam in 2 days',
    }))
    expect(rowByTopicId.get('needs-focus')).toEqual(expect.objectContaining({
      status: 'Needs Focus',
      actionLabel: 'Keep practising',
      actionReason: 'not studied in a while',
    }))
    expect(rowByTopicId.get('revision-ready')).toEqual(expect.objectContaining({
      status: 'Revision Ready',
      actionLabel: 'Ready to revise',
      actionReason: 'solid and recently practised',
    }))
    expect(rowByTopicId.get('complete')).toEqual(expect.objectContaining({
      status: 'Complete',
      actionLabel: 'Well covered',
      actionReason: 'reviewed recently',
    }))
    expect(rowByTopicId.get('scheduled')).toEqual(expect.objectContaining({
      status: 'Scheduled',
      actionLabel: 'On track',
      actionReason: 'no urgent changes needed',
    }))
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

  it('treats a paper attempt as the last session when it is the newest logged activity', () => {
    const summary = buildLastSessionSummary(
      [session({ topicId: 'topic-1', date: '2026-04-14', timestamp: new Date('2026-04-14T12:00:00').getTime() })],
      [topic({ id: 'topic-1', offeringId: 'offering-1' })],
      [offering({ id: 'offering-1', subjectId: 'subject-1' })],
      [subject({ id: 'subject-1', name: 'Geography' })],
      [paper({ id: 'paper-1', offeringId: 'offering-1', name: 'Paper 1' })],
      [paperAttempt({ paperId: 'paper-1', date: '2026-04-15', timestamp: new Date('2026-04-15T18:00:00').getTime(), rawMark: 47, totalMarks: 80 })],
    )

    expect(summary).toEqual(expect.objectContaining({
      kind: 'paper',
      paper: expect.objectContaining({ name: 'Paper 1' }),
      subject: expect.objectContaining({ name: 'Geography' }),
    }))
  })

  it('includes paper attempts in the calendar day meta totals', () => {
    const dayMeta = buildProgressCalendarDayMeta(
      [],
      [],
      [offering({ id: 'offering-1', subjectId: 'subject-1' })],
      [subject({ id: 'subject-1', name: 'Geography' })],
      [],
      [paperAttempt({ paperId: 'paper-1', date: '2026-04-15', durationSeconds: 5400, rawMark: 47, totalMarks: 80 })],
      [paper({ id: 'paper-1', offeringId: 'offering-1', name: 'Paper 1' })],
    )

    expect(dayMeta.get('2026-04-15')).toEqual(expect.objectContaining({
      sessionCount: 1,
      totalDurationSeconds: 5400,
    }))
  })
})
