import { describe, it, expect } from 'vitest'
import {
  weakness,
  urgency,
  recencyFactor,
  topicScore,
  updatePerformance,
  adjustConfidence,
  maxDeepBlocks,
  daysRemaining,
  scoreAllTopics,
  sortScoredTopics,
  buildDayPlan,
  diversifyTopics,
  getSuggestions,
  getOverdueTopics,
  autoFillPlanItems,
  OVERDUE_RECENCY_THRESHOLD,
  OVERDUE_WEAKNESS_THRESHOLD,
} from './engine'
import type { Topic, Paper, Subject, Offering, ScoredTopic, ScheduleItem } from '../types'

const TODAY = new Date('2026-05-01T00:00:00Z')

// Helper to build test fixtures with v2 shape
function mkOffering(id: string, subjectId: string): Offering {
  return { id, subjectId, boardId: 'aqa', spec: '0000', label: 'AQA 0000' }
}

// -- Core Formula Components --

describe('weakness', () => {
  it('perf=0.6, conf=3 → 0.40', () => {
    expect(weakness(0.6, 3)).toBeCloseTo(0.4, 3)
  })
})

describe('urgency', () => {
  it('10 days → 0.316', () => {
    expect(urgency('2026-05-11', TODAY)).toBeCloseTo(0.316, 3)
  })
})

describe('recencyFactor', () => {
  it('null → 1.4', () => {
    expect(recencyFactor(null, TODAY)).toBeCloseTo(1.4, 3)
  })

  it('0 days → 0.5', () => {
    expect(recencyFactor('2026-05-01', TODAY)).toBeCloseTo(0.5, 3)
  })

  it('2 days → 0.7', () => {
    expect(recencyFactor('2026-04-29', TODAY)).toBeCloseTo(0.7, 3)
  })

  it('5 days → 0.85', () => {
    expect(recencyFactor('2026-04-26', TODAY)).toBeCloseTo(0.85, 3)
  })

  it('10 days → 1.0', () => {
    expect(recencyFactor('2026-04-21', TODAY)).toBeCloseTo(1.0, 3)
  })

  it('15 days → 1.15', () => {
    expect(recencyFactor('2026-04-16', TODAY)).toBeCloseTo(1.15, 3)
  })

  it('30 days → 1.4', () => {
    expect(recencyFactor('2026-04-01', TODAY)).toBeCloseTo(1.4, 3)
  })
})

describe('daysRemaining', () => {
  it('exam today → 1', () => {
    expect(daysRemaining('2026-05-01', TODAY)).toBe(1)
  })
})

// -- Full Topic Scores (Simulation Values) --

describe('simulation topic scores', () => {
  it('CS Algorithms (5d ago) → 0.107', () => {
    expect(topicScore(0.6, 3, '2026-05-11', '2026-04-26', TODAY)).toBeCloseTo(0.1075, 2)
  })

  it('English Literature Macbeth (8d ago) → 0.149', () => {
    expect(topicScore(0.5, 3, '2026-05-11', '2026-04-23', TODAY)).toBeCloseTo(0.1486, 2)
  })

  it('Biology Cell Division (2d ago) → 0.057', () => {
    expect(topicScore(0.7, 4, '2026-05-12', '2026-04-29', TODAY)).toBeCloseTo(0.0570, 2)
  })

  it('Maths Algebra (15d ago) → 0.191', () => {
    expect(topicScore(0.4, 2, '2026-05-14', '2026-04-16', TODAY)).toBeCloseTo(0.1914, 2)
  })

  it('Physics Electricity (30d ago) → 0.116', () => {
    expect(topicScore(0.5, 3, '2026-06-02', '2026-04-01', TODAY)).toBeCloseTo(0.1163, 2)
  })

  it('Spanish Speaking (1d ago) → 0.022', () => {
    expect(topicScore(0.8, 4, '2026-06-09', '2026-04-30', TODAY)).toBeCloseTo(0.0224, 2)
  })
})

// -- Performance Update --

describe('updatePerformance', () => {
  it('0.5 and 0.9 → 0.62', () => {
    expect(updatePerformance(0.5, 0.9)).toBeCloseTo(0.62, 3)
  })
})

// -- Confidence Adjustment --

describe('adjustConfidence', () => {
  it('score < 0.5 → conf−1', () => {
    expect(adjustConfidence(3, 0.4)).toBe(2)
  })

  it('score > 0.8 → conf+1', () => {
    expect(adjustConfidence(3, 0.9)).toBe(4)
  })

  it('clamps lower bound to 1', () => {
    expect(adjustConfidence(1, 0.4)).toBe(1)
  })

  it('clamps upper bound to 5', () => {
    expect(adjustConfidence(5, 0.9)).toBe(5)
  })

  it('score between 0.5-0.8 → no change', () => {
    expect(adjustConfidence(3, 0.6)).toBe(3)
  })
})

// -- Daily Load Logic --

describe('maxDeepBlocks', () => {
  it('(3,2) → 3', () => {
    expect(maxDeepBlocks(3, 2)).toBe(3)
  })

  it('(3,4) → 2', () => {
    expect(maxDeepBlocks(3, 4)).toBe(2)
  })

  it('(1,5) → 0', () => {
    expect(maxDeepBlocks(1, 5)).toBe(0)
  })

  it('(5,1) → 4 (capped)', () => {
    expect(maxDeepBlocks(5, 1)).toBe(4)
  })
})

// -- Sort Tiebreak --

describe('sortScoredTopics', () => {
  it('score desc → perf asc → name asc', () => {
    const off = mkOffering('o-s', 's')
    const mkTopic = (id: string, name: string, perf: number): ScoredTopic => ({
      topic: { id, paperId: 'p', offeringId: 'o-s', name, confidence: 3, performanceScore: perf, lastReviewed: null },
      paper: { id: 'p', offeringId: 'o-s', name: 'P1', examDate: '2026-05-10' },
      offering: off,
      subject: { id: 's', name: 'S', color: '#000' },
      score: 0.5,
      blockType: 'deep',
      weakness: 0.5,
      recencyFactor: 1.0,
    })

    const topics = [
      mkTopic('a', 'Beta', 0.6),
      mkTopic('b', 'Alpha', 0.6),
      mkTopic('c', 'Gamma', 0.4),
    ]

    const sorted = sortScoredTopics(topics)
    expect(sorted[0].topic.id).toBe('c')
    expect(sorted[1].topic.id).toBe('b')
    expect(sorted[2].topic.id).toBe('a')
  })
})

// -- scoreAllTopics --

describe('scoreAllTopics', () => {
  it('excludes past papers', () => {
    const topics: Topic[] = [
      { id: 't1', paperId: 'p-past', offeringId: 'o1', name: 'Past', confidence: 3, performanceScore: 0.5, lastReviewed: null },
      { id: 't2', paperId: 'p-future', offeringId: 'o1', name: 'Future', confidence: 3, performanceScore: 0.5, lastReviewed: null },
    ]
    const papers: Paper[] = [
      { id: 'p-past', offeringId: 'o1', name: 'Past Paper', examDate: '2026-04-01' },
      { id: 'p-future', offeringId: 'o1', name: 'Future Paper', examDate: '2026-06-01' },
    ]
    const offerings: Offering[] = [mkOffering('o1', 's1')]
    const subjects: Subject[] = [{ id: 's1', name: 'Test', color: '#000' }]

    const scored = scoreAllTopics(topics, papers, offerings, subjects, TODAY)
    expect(scored).toHaveLength(1)
    expect(scored[0].topic.id).toBe('t2')
  })

  it('includes precomputed weakness and recencyFactor', () => {
    const topics: Topic[] = [
      { id: 't1', paperId: 'p1', offeringId: 'o1', name: 'T1', confidence: 3, performanceScore: 0.6, lastReviewed: null },
    ]
    const papers: Paper[] = [
      { id: 'p1', offeringId: 'o1', name: 'P1', examDate: '2026-06-01' },
    ]
    const offerings: Offering[] = [mkOffering('o1', 's1')]
    const subjects: Subject[] = [{ id: 's1', name: 'Test', color: '#000' }]

    const scored = scoreAllTopics(topics, papers, offerings, subjects, TODAY)
    expect(scored[0].weakness).toBeCloseTo(weakness(0.6, 3), 5)
    expect(scored[0].recencyFactor).toBeCloseTo(recencyFactor(null, TODAY), 5)
  })
})

// -- diversifyTopics --

describe('diversifyTopics', () => {
  const mkScored = (id: string, subjectId: string, score: number, examDate = '2026-05-30'): ScoredTopic => ({
    topic: { id, paperId: 'p', offeringId: `o-${subjectId}`, name: id, confidence: 3, performanceScore: 0.5, lastReviewed: null },
    paper: { id: 'p', offeringId: `o-${subjectId}`, name: 'P1', examDate },
    offering: mkOffering(`o-${subjectId}`, subjectId),
    subject: { id: subjectId, name: subjectId, color: '#000' },
    score,
    blockType: 'deep',
    weakness: 0.5,
    recencyFactor: 1.0,
  })

  it('limits to 2 per subject', () => {
    const topics = [
      mkScored('a', 'cs', 0.9),
      mkScored('b', 'cs', 0.8),
      mkScored('c', 'cs', 0.7),
      mkScored('d', 'maths', 0.6),
      mkScored('e', 'bio', 0.5),
    ]
    const result = diversifyTopics(topics, 4, TODAY)
    const csCount = result.filter((t) => t.subject.id === 'cs').length
    expect(csCount).toBe(2)
    expect(result).toHaveLength(4)
  })

  it('allows >2 per subject if exam < 7 days', () => {
    const topics = [
      mkScored('a', 'cs', 0.9, '2026-05-05'),
      mkScored('b', 'cs', 0.8, '2026-05-05'),
      mkScored('c', 'cs', 0.7, '2026-05-05'),
      mkScored('d', 'maths', 0.6),
    ]
    const result = diversifyTopics(topics, 4, TODAY)
    const csCount = result.filter((t) => t.subject.id === 'cs').length
    expect(csCount).toBe(3)
  })
})

// -- buildDayPlan --

describe('buildDayPlan', () => {
  const mkScored = (id: string, score: number, subjectId = id): ScoredTopic => ({
    topic: { id, paperId: `p-${id}`, offeringId: `o-${subjectId}`, name: id, confidence: 3, performanceScore: 0.5, lastReviewed: null },
    paper: { id: `p-${id}`, offeringId: `o-${subjectId}`, name: 'P1', examDate: '2026-05-10' },
    offering: mkOffering(`o-${subjectId}`, subjectId),
    subject: { id: subjectId, name: subjectId, color: '#000' },
    score,
    blockType: 'deep',
    weakness: 0.5,
    recencyFactor: 1.0,
  })

  it('deep + recall <= 4', () => {
    const topics = [mkScored('a', 0.9), mkScored('b', 0.8), mkScored('c', 0.7), mkScored('d', 0.6), mkScored('e', 0.5)]
    const plan = buildDayPlan(topics, { energyLevel: 3, stress: 2 }, TODAY)
    expect(plan.deep.length + plan.recall.length).toBeLessThanOrEqual(4)
  })

  it('splits deep/recall by maxDeepBlocks', () => {
    const topics = [mkScored('a', 0.9), mkScored('b', 0.8), mkScored('c', 0.7), mkScored('d', 0.6)]
    const plan = buildDayPlan(topics, { energyLevel: 3, stress: 2 }, TODAY)
    expect(plan.deep).toHaveLength(3)
    expect(plan.recall).toHaveLength(1)
    expect(plan.deep.every((t) => t.blockType === 'deep')).toBe(true)
    expect(plan.recall.every((t) => t.blockType === 'recall')).toBe(true)
  })

  it('high stress reduces deep blocks', () => {
    const topics = [mkScored('a', 0.9), mkScored('b', 0.8), mkScored('c', 0.7), mkScored('d', 0.6)]
    const plan = buildDayPlan(topics, { energyLevel: 3, stress: 4 }, TODAY)
    expect(plan.deep).toHaveLength(2)
    expect(plan.recall).toHaveLength(2)
  })
})

// -- getSuggestions --

describe('getSuggestions', () => {
  const mkScored = (id: string, score: number, subjectId = 's1'): ScoredTopic => ({
    topic: { id, paperId: 'p', offeringId: `o-${subjectId}`, name: id, confidence: 3, performanceScore: 0.5, lastReviewed: null },
    paper: { id: 'p', offeringId: `o-${subjectId}`, name: 'P1', examDate: '2026-05-30' },
    offering: mkOffering(`o-${subjectId}`, subjectId),
    subject: { id: subjectId, name: subjectId, color: '#000' },
    score,
    blockType: 'deep',
    weakness: 0.5,
    recencyFactor: 1.0,
  })

  it('returns max 6', () => {
    const scored = Array.from({ length: 10 }, (_, i) => mkScored(`t${i}`, 1 - i * 0.05))
    const result = getSuggestions(scored, new Set())
    expect(result).toHaveLength(6)
  })

  it('excludes specified IDs', () => {
    const scored = [mkScored('a', 0.9), mkScored('b', 0.8), mkScored('c', 0.7)]
    const result = getSuggestions(scored, new Set(['a']))
    expect(result.find((s) => s.topic.id === 'a')).toBeUndefined()
    expect(result).toHaveLength(2)
  })

  it('preserves sort order (desc by score)', () => {
    const scored = [mkScored('a', 0.5), mkScored('b', 0.9), mkScored('c', 0.7)]
    const result = getSuggestions(scored, new Set())
    expect(result[0].topic.id).toBe('b')
    expect(result[1].topic.id).toBe('c')
    expect(result[2].topic.id).toBe('a')
  })
})

// -- getOverdueTopics --

describe('getOverdueTopics', () => {
  const mkScored = (id: string, w: number, r: number, lastReviewed: string | null = null): ScoredTopic => ({
    topic: { id, paperId: 'p', offeringId: 'o-s', name: id, confidence: 3, performanceScore: 0.5, lastReviewed },
    paper: { id: 'p', offeringId: 'o-s', name: 'P1', examDate: '2026-05-30' },
    offering: mkOffering('o-s', 's'),
    subject: { id: 's', name: 'S', color: '#000' },
    score: 0.5,
    blockType: 'deep',
    weakness: w,
    recencyFactor: r,
  })

  it('returns topics above both thresholds', () => {
    const scored = [
      mkScored('a', OVERDUE_WEAKNESS_THRESHOLD, OVERDUE_RECENCY_THRESHOLD, '2026-04-01'),
      mkScored('b', 0.3, 1.2, '2026-04-15'),
      mkScored('c', 0.8, 1.0, '2026-04-25'),
    ]
    const result = getOverdueTopics(scored)
    expect(result).toHaveLength(1)
    expect(result[0].topic.id).toBe('a')
  })

  it('returns empty when nothing overdue', () => {
    const scored = [mkScored('a', 0.3, 1.0, '2026-04-28')]
    expect(getOverdueTopics(scored)).toHaveLength(0)
  })

  it('excludes never-reviewed topics even if recency and weakness meet thresholds', () => {
    const scored = [
      mkScored('a', 0.8, OVERDUE_RECENCY_THRESHOLD, null),
    ]
    const result = getOverdueTopics(scored)
    expect(result).toHaveLength(0)
  })
})

// -- autoFillPlanItems --

describe('autoFillPlanItems', () => {
  const mkScored = (id: string, score: number, subjectId = 's1'): ScoredTopic => ({
    topic: { id, paperId: 'p', offeringId: `o-${subjectId}`, name: id, confidence: 3, performanceScore: 0.5, lastReviewed: null },
    paper: { id: 'p', offeringId: `o-${subjectId}`, name: 'P1', examDate: '2026-05-30' },
    offering: mkOffering(`o-${subjectId}`, subjectId),
    subject: { id: subjectId, name: subjectId, color: '#000' },
    score,
    blockType: 'deep',
    weakness: 0.5,
    recencyFactor: 1.0,
  })

  const mkItem = (topicId: string): ScheduleItem => ({
    id: `si-${topicId}`,
    topicId,
    source: 'manual',
    addedAt: 1000,
    dayKey: '2026-05-01',
  })

  it('fills remaining slots only', () => {
    const scored = [mkScored('a', 0.9, 'sa'), mkScored('b', 0.8, 'sb'), mkScored('c', 0.7, 'sc'), mkScored('d', 0.6, 'sd')]
    const existing = [mkItem('a')]
    const result = autoFillPlanItems(scored, existing, '2026-05-01', 2000)
    expect(result).toHaveLength(3)
  })

  it('max 2/subject across tray + fill', () => {
    const scored = [
      mkScored('a', 0.9, 'bio'),
      mkScored('b', 0.8, 'bio'),
      mkScored('c', 0.7, 'bio'),
      mkScored('d', 0.6, 'cs'),
      mkScored('e', 0.5, 'cs'),
      mkScored('f', 0.4, 'maths'),
    ]
    const existing = [mkItem('a')]
    const result = autoFillPlanItems(scored, existing, '2026-05-01', 2000)
    const bioCount = result.filter((i) => {
      const s = scored.find((sc) => sc.topic.id === i.topicId)
      return s?.subject.id === 'bio'
    }).length
    expect(bioCount).toBeLessThanOrEqual(1)
  })

  it('handles fewer topics than slots', () => {
    const scored = [mkScored('a', 0.9)]
    const result = autoFillPlanItems(scored, [], '2026-05-01', 2000)
    expect(result).toHaveLength(1)
  })

  it('skips duplicates', () => {
    const scored = [mkScored('a', 0.9), mkScored('b', 0.8)]
    const existing = [mkItem('a')]
    const result = autoFillPlanItems(scored, existing, '2026-05-01', 2000)
    expect(result.find((i) => i.topicId === 'a')).toBeUndefined()
  })

  it('returns empty when tray is full', () => {
    const scored = [mkScored('a', 0.9)]
    const existing = [mkItem('x'), mkItem('y'), mkItem('z'), mkItem('w')]
    const result = autoFillPlanItems(scored, existing, '2026-05-01', 2000)
    expect(result).toHaveLength(0)
  })
})

// -- Behavioral Rotation Tests --

describe('piecewise cooldown rotation', () => {
  it('neglected topic beats just-studied topic despite weaker weakness', () => {
    // perf=0.5 reviewed 21+ days ago vs perf=0.3 reviewed today
    // Same exam date so urgency is equal
    const neglectedScore = topicScore(0.5, 3, '2026-05-11', '2026-04-01', TODAY)
    const justStudiedScore = topicScore(0.3, 3, '2026-05-11', '2026-05-01', TODAY)
    expect(neglectedScore).toBeGreaterThan(justStudiedScore)
  })

  it('score-driven rotation spans subjects before diversifyTopics', () => {
    // 4 subjects, one is weakest but just studied today
    const topics: Topic[] = [
      { id: 't-cs1', paperId: 'p-cs', offeringId: 'o-cs', name: 'CS Weak', confidence: 2, performanceScore: 0.3, lastReviewed: '2026-05-01' },
      { id: 't-cs2', paperId: 'p-cs', offeringId: 'o-cs', name: 'CS Other', confidence: 3, performanceScore: 0.5, lastReviewed: '2026-05-01' },
      { id: 't-math', paperId: 'p-math', offeringId: 'o-math', name: 'Math Topic', confidence: 3, performanceScore: 0.5, lastReviewed: '2026-04-20' },
      { id: 't-bio', paperId: 'p-bio', offeringId: 'o-bio', name: 'Bio Topic', confidence: 3, performanceScore: 0.5, lastReviewed: '2026-04-15' },
      { id: 't-eng', paperId: 'p-eng', offeringId: 'o-eng', name: 'Eng Topic', confidence: 3, performanceScore: 0.5, lastReviewed: '2026-04-10' },
    ]
    const papers: Paper[] = [
      { id: 'p-cs', offeringId: 'o-cs', name: 'CS Paper', examDate: '2026-05-15' },
      { id: 'p-math', offeringId: 'o-math', name: 'Math Paper', examDate: '2026-05-15' },
      { id: 'p-bio', offeringId: 'o-bio', name: 'Bio Paper', examDate: '2026-05-15' },
      { id: 'p-eng', offeringId: 'o-eng', name: 'Eng Paper', examDate: '2026-05-15' },
    ]
    const offerings: Offering[] = [
      mkOffering('o-cs', 's-cs'),
      mkOffering('o-math', 's-math'),
      mkOffering('o-bio', 's-bio'),
      mkOffering('o-eng', 's-eng'),
    ]
    const subjects: Subject[] = [
      { id: 's-cs', name: 'CS', color: '#000' },
      { id: 's-math', name: 'Math', color: '#111' },
      { id: 's-bio', name: 'Bio', color: '#222' },
      { id: 's-eng', name: 'Eng', color: '#333' },
    ]

    const scored = scoreAllTopics(topics, papers, offerings, subjects, TODAY)
    const sorted = sortScoredTopics(scored)
    // Top 4 should already span multiple subjects without needing diversifyTopics
    const top4 = sorted.slice(0, 4)
    const uniqueSubjects = new Set(top4.map((s) => s.subject.id))
    expect(uniqueSubjects.size).toBeGreaterThanOrEqual(3)
  })
})
