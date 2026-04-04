import seedData from '../../src/data/subjects.json' with { type: 'json' }
import { SEED_REVISION } from '../../src/lib/constants.ts'
import type { PersistedState } from '../helpers/seedAppState'

const seed = seedData as {
  version: 2
  boards: unknown[]
  subjects: unknown[]
  offerings: { id: string; subjectId: string; boardId: string; spec: string; label: string }[]
  papers: { id: string; offeringId: string; name: string; examDate: string; examTime?: string }[]
  topics: { id: string; paperId: string; offeringId: string; name: string; confidence: number; performanceScore: number; lastReviewed: string | null }[]
}

// -- Validation helpers --

function requireOffering(id: string) {
  if (!seed.offerings.find(o => o.id === id))
    throw new Error(`Fixture requires offering "${id}" which is missing from seed`)
}

function requireTopic(id: string) {
  if (!seed.topics.find(t => t.id === id))
    throw new Error(`Fixture requires topic "${id}" which is missing from seed`)
}

// Validate all offerings/topics used in fixtures
;['cs-aqa', 'bio-aqa', 'maths-edexcel', 'eng-lit-aqa', 'phys-aqa', 'geo-aqa'].forEach(requireOffering)
;['cs-001', 'cs-002', 'cs-003', 'cs-004', 'cs-005', 'cs-006', 'cs-007', 'cs-008',
  'cs-009', 'cs-010', 'cs-011', 'cs-012', 'cs-013', 'cs-014',
  'bio-001', 'bio-002', 'bio-003', 'bio-004', 'bio-005', 'bio-006', 'bio-007',
  'bio-008', 'bio-009', 'bio-010',
  'maths-001', 'maths-002', 'maths-003', 'maths-004', 'maths-005',
  'eng-lit-001', 'eng-lit-002', 'eng-lit-003', 'eng-lit-004', 'eng-lit-005',
].forEach(requireTopic)

// -- Base builder --

function baseState(offeringIds: string[]): PersistedState {
  return {
    version: 2,
    seedRevision: SEED_REVISION,
    boards: JSON.parse(JSON.stringify(seed.boards)),
    subjects: JSON.parse(JSON.stringify(seed.subjects)),
    offerings: JSON.parse(JSON.stringify(seed.offerings)),
    papers: JSON.parse(JSON.stringify(seed.papers)),
    topics: JSON.parse(JSON.stringify(seed.topics)),
    sessions: [],
    paperAttempts: [],
    notes: [],
    userState: { energyLevel: 3, stress: 2 },
    onboarded: true,
    selectedOfferingIds: offeringIds,
    dailyPlan: [],
    planDay: '',
  }
}

function makeSession(topicId: string, date: string, score: number, durationSeconds?: number, timestamp?: number) {
  return {
    id: `${topicId}-${date}-${Math.random().toString(36).slice(2, 8)}`,
    topicId,
    date,
    score,
    timestamp: timestamp ?? new Date(date + 'T12:00:00').getTime(),
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
  }
}

function setTopicFields(
  state: PersistedState,
  topicId: string,
  fields: { confidence?: number; performanceScore?: number; lastReviewed?: string | null },
) {
  const topics = state.topics as { id: string; confidence: number; performanceScore: number; lastReviewed: string | null }[]
  const t = topics.find(t => t.id === topicId)
  if (!t) throw new Error(`Topic ${topicId} not found in state`)
  if (fields.confidence !== undefined) t.confidence = fields.confidence
  if (fields.performanceScore !== undefined) t.performanceScore = fields.performanceScore
  if (fields.lastReviewed !== undefined) t.lastReviewed = fields.lastReviewed
}

/** Override ALL paper exam dates for a given offering. */
function setOfferingExamDate(state: PersistedState, offeringId: string, newDate: string) {
  const papers = state.papers as { id: string; offeringId: string; examDate: string }[]
  for (const p of papers) {
    if (p.offeringId === offeringId) p.examDate = newDate
  }
}

function makePaperAttempt(
  paperId: string,
  date: string,
  confidence: number,
  durationSeconds: number,
  rawMark?: number,
  totalMarks?: number,
  noteText?: string,
  taggedTopicIds?: string[],
) {
  return {
    id: `${paperId}-${date}-${Math.random().toString(36).slice(2, 8)}`,
    paperId,
    date,
    timestamp: new Date(date + 'T18:00:00').getTime(),
    durationSeconds,
    confidence,
    ...(rawMark !== undefined ? { rawMark } : {}),
    ...(totalMarks !== undefined ? { totalMarks } : {}),
    ...(noteText ? { noteText } : {}),
    ...(taggedTopicIds?.length ? { taggedTopicIds } : {}),
    source: 'calendar' as const,
  }
}

// Test-owned exam dates relative to frozen date 2026-04-15
const EXAM_NEAR = '2026-05-05'  // 20 days — triggers "At risk soon" with low coverage
const EXAM_FAR = '2026-06-30'   // 76 days — safe from "At risk soon"
const EXAM_PAST = '2026-03-01'  // in the past

// =========================================================================
// FIXTURES
// =========================================================================

// 1. Empty state — no sessions, no notes
// All exams ≤30d so all subjects show "At risk soon" (0% coverage)
export function progressEmpty(): PersistedState {
  const s = baseState(['cs-aqa', 'bio-aqa', 'maths-edexcel', 'eng-lit-aqa'])
  setOfferingExamDate(s, 'cs-aqa', EXAM_NEAR)
  setOfferingExamDate(s, 'bio-aqa', EXAM_NEAR)
  setOfferingExamDate(s, 'maths-edexcel', EXAM_NEAR)
  setOfferingExamDate(s, 'eng-lit-aqa', EXAM_NEAR)
  return s
}

// 2. One session today only → streak=1
export function progressTodayOnly(): PersistedState {
  const s = baseState(['cs-aqa', 'bio-aqa'])
  setOfferingExamDate(s, 'cs-aqa', EXAM_FAR)
  setOfferingExamDate(s, 'bio-aqa', EXAM_FAR)
  s.sessions = [
    makeSession('cs-001', '2026-04-15', 0.7, 1200),
  ]
  setTopicFields(s, 'cs-001', { lastReviewed: '2026-04-15', performanceScore: 0.7, confidence: 3 })
  return s
}

// 3. Sessions on 3 consecutive days → streak=3
export function progressStreak(): PersistedState {
  const s = baseState(['cs-aqa', 'bio-aqa'])
  setOfferingExamDate(s, 'cs-aqa', EXAM_FAR)
  setOfferingExamDate(s, 'bio-aqa', EXAM_FAR)
  s.sessions = [
    makeSession('cs-001', '2026-04-13', 0.6, 900),
    makeSession('bio-001', '2026-04-14', 0.65, 1000),
    makeSession('cs-002', '2026-04-15', 0.7, 1200),
  ]
  setTopicFields(s, 'cs-001', { lastReviewed: '2026-04-13', performanceScore: 0.4, confidence: 2 })
  setTopicFields(s, 'bio-001', { lastReviewed: '2026-04-14', performanceScore: 0.65 })
  setTopicFields(s, 'cs-002', { lastReviewed: '2026-04-15', performanceScore: 0.7 })
  return s
}

// 4. Mixed statuses: At risk, Needs attention, Improving, On track
export function progressMixedStatuses(): PersistedState {
  const s = baseState(['cs-aqa', 'bio-aqa', 'maths-edexcel', 'eng-lit-aqa', 'phys-aqa'])
  // Pin exam dates: cs near (At risk), others far (won't trigger At risk)
  setOfferingExamDate(s, 'cs-aqa', EXAM_NEAR)
  setOfferingExamDate(s, 'bio-aqa', EXAM_FAR)
  setOfferingExamDate(s, 'maths-edexcel', EXAM_FAR)
  setOfferingExamDate(s, 'eng-lit-aqa', EXAM_FAR)
  setOfferingExamDate(s, 'phys-aqa', EXAM_FAR)

  // cs-aqa: exam 20 days away, coverage <60% of 14 topics → "At risk soon"
  // Only review 4 of 14 cs topics (28% coverage, well below 60%)
  for (const tid of ['cs-001', 'cs-002', 'cs-003', 'cs-004']) {
    setTopicFields(s, tid, { lastReviewed: '2026-04-14', performanceScore: 0.5, confidence: 2 })
  }
  s.sessions.push(
    makeSession('cs-001', '2026-04-14', 0.5, 600),
    makeSession('cs-002', '2026-04-14', 0.5, 600),
    makeSession('cs-003', '2026-04-14', 0.5, 600),
    makeSession('cs-004', '2026-04-14', 0.5, 600),
  )

  // bio-aqa: coverage >60%, has weak topics → "Needs attention"
  // Review 7 of 10 bio topics (70% coverage)
  for (const tid of ['bio-001', 'bio-002', 'bio-003', 'bio-004', 'bio-005', 'bio-006', 'bio-007']) {
    setTopicFields(s, tid, { lastReviewed: '2026-04-13', performanceScore: 0.4, confidence: 2 })
  }
  s.sessions.push(
    ...['bio-001', 'bio-002', 'bio-003', 'bio-004', 'bio-005', 'bio-006', 'bio-007'].map(
      tid => makeSession(tid, '2026-04-13', 0.4, 600),
    ),
  )

  // maths-edexcel: recent scores > prev week → "Improving"
  // Need coverage >= 60% to avoid "At risk soon" (maths has 60 topics, need 36+ reviewed)
  // Also need no weak topics to avoid "Needs attention"
  // And need sessions in both last 7d and prev 7d with improvement
  const mathsTopicIds = seed.topics.filter(t => t.offeringId === 'maths-edexcel').map(t => t.id)
  // Review all 60 maths topics with good perf
  for (const tid of mathsTopicIds) {
    setTopicFields(s, tid, { lastReviewed: '2026-04-07', performanceScore: 0.8, confidence: 4 })
  }
  // Prev week sessions (04-02 to 04-08) — lower scores
  s.sessions.push(
    makeSession('maths-001', '2026-04-05', 0.4, 600),
    makeSession('maths-002', '2026-04-06', 0.4, 600),
    makeSession('maths-003', '2026-04-07', 0.4, 600),
  )
  // This week sessions (04-09 to 04-15) — higher scores
  s.sessions.push(
    makeSession('maths-004', '2026-04-12', 0.8, 600),
    makeSession('maths-005', '2026-04-13', 0.8, 600),
  )

  // eng-lit-aqa: no weak topics, no improving signal → "On track"
  // Review all topics with good perf, no sessions in prev week for comparison
  for (const tid of ['eng-lit-001', 'eng-lit-002', 'eng-lit-003', 'eng-lit-004', 'eng-lit-005']) {
    setTopicFields(s, tid, { lastReviewed: '2026-04-10', performanceScore: 0.85, confidence: 4 })
  }
  s.sessions.push(
    ...['eng-lit-001', 'eng-lit-002', 'eng-lit-003', 'eng-lit-004', 'eng-lit-005'].map(
      tid => makeSession(tid, '2026-04-10', 0.85, 600),
    ),
  )

  return s
}

// 5. Distribution with duration — sessions across 2 subjects with durationSeconds
export function progressDistDuration(): PersistedState {
  const s = baseState(['cs-aqa', 'bio-aqa'])
  setOfferingExamDate(s, 'cs-aqa', EXAM_FAR)
  setOfferingExamDate(s, 'bio-aqa', EXAM_FAR)
  s.sessions = [
    makeSession('cs-001', '2026-04-12', 0.7, 1800),
    makeSession('cs-002', '2026-04-13', 0.6, 1500),
    makeSession('bio-001', '2026-04-14', 0.8, 2400),
    makeSession('bio-002', '2026-04-15', 0.75, 1200),
  ]
  setTopicFields(s, 'cs-001', { lastReviewed: '2026-04-12', performanceScore: 0.7 })
  setTopicFields(s, 'cs-002', { lastReviewed: '2026-04-13', performanceScore: 0.6 })
  setTopicFields(s, 'bio-001', { lastReviewed: '2026-04-14', performanceScore: 0.8 })
  setTopicFields(s, 'bio-002', { lastReviewed: '2026-04-15', performanceScore: 0.75 })
  return s
}

// 6. Distribution fallback to counts — sessions without durationSeconds
export function progressDistCounts(): PersistedState {
  const s = baseState(['cs-aqa', 'bio-aqa'])
  setOfferingExamDate(s, 'cs-aqa', EXAM_FAR)
  setOfferingExamDate(s, 'bio-aqa', EXAM_FAR)
  s.sessions = [
    makeSession('cs-001', '2026-04-12', 0.7),
    makeSession('cs-002', '2026-04-13', 0.6),
    makeSession('cs-003', '2026-04-14', 0.65),
    makeSession('bio-001', '2026-04-14', 0.8),
    makeSession('bio-002', '2026-04-15', 0.75),
  ]
  setTopicFields(s, 'cs-001', { lastReviewed: '2026-04-12', performanceScore: 0.7 })
  setTopicFields(s, 'cs-002', { lastReviewed: '2026-04-13', performanceScore: 0.6 })
  setTopicFields(s, 'cs-003', { lastReviewed: '2026-04-14', performanceScore: 0.65 })
  setTopicFields(s, 'bio-001', { lastReviewed: '2026-04-14', performanceScore: 0.8 })
  setTopicFields(s, 'bio-002', { lastReviewed: '2026-04-15', performanceScore: 0.75 })
  return s
}

// 7. Expanded notes + confidence gap
export function progressExpandedNotes(): PersistedState {
  const s = baseState(['cs-aqa'])
  setOfferingExamDate(s, 'cs-aqa', EXAM_FAR)
  // Sessions across several topics
  s.sessions = [
    makeSession('cs-001', '2026-04-13', 0.5, 900),
    makeSession('cs-002', '2026-04-14', 0.4, 800),
    makeSession('cs-003', '2026-04-15', 0.45, 1000),
  ]
  // Set high confidence but low perf → overconfident gap
  for (const tid of ['cs-001', 'cs-002', 'cs-003', 'cs-004', 'cs-005', 'cs-006', 'cs-007', 'cs-008', 'cs-009', 'cs-010', 'cs-011', 'cs-012', 'cs-013', 'cs-014']) {
    setTopicFields(s, tid, { lastReviewed: '2026-04-13', performanceScore: 0.4, confidence: 5 })
  }

  // 5 notes on cs topics
  s.notes = [
    { id: 'n1', topicId: 'cs-001', date: '2026-04-13', text: 'Revisit merge sort edge cases' },
    { id: 'n2', topicId: 'cs-002', date: '2026-04-13', text: 'Practice trace tables for while loops' },
    { id: 'n3', topicId: 'cs-003', date: '2026-04-14', text: 'Draw flowcharts for complex conditions' },
    { id: 'n4', topicId: 'cs-009', date: '2026-04-14', text: 'Binary to hexadecimal conversion tips' },
    { id: 'n5', topicId: 'cs-011', date: '2026-04-15', text: 'Remember layers of TCP/IP model' },
  ]

  return s
}

// 8b. Future exam day with study activity on the same day
export function progressExamAndActivitySameDay(): PersistedState {
  const s = baseState(['cs-aqa'])
  setOfferingExamDate(s, 'cs-aqa', EXAM_NEAR)
  s.sessions = [
    makeSession('cs-003', '2026-05-05', 0.72, 1500),
    makeSession('cs-002', '2026-04-14', 0.55, 900),
  ]
  setTopicFields(s, 'cs-003', { lastReviewed: '2026-05-05', performanceScore: 0.72, confidence: 4 })
  setTopicFields(s, 'cs-002', { lastReviewed: '2026-04-14', performanceScore: 0.55, confidence: 3 })
  s.notes = [
    { id: 'same-day-note', topicId: 'cs-011', date: '2026-05-05', text: 'Recheck the TCP/IP layers before the exam.' },
  ]
  return s
}

export function progressPlanNowSwap(): PersistedState {
  const s = progressMixedStatuses()
  s.dailyPlan = [
    { id: 'plan-1', topicId: 'cs-001', source: 'auto', addedAt: new Date('2026-04-15T08:00:00').getTime(), dayKey: '2026-04-15' },
    { id: 'plan-2', topicId: 'bio-001', source: 'auto', addedAt: new Date('2026-04-15T08:05:00').getTime(), dayKey: '2026-04-15' },
    { id: 'plan-3', topicId: 'maths-001', source: 'suggested', addedAt: new Date('2026-04-15T08:10:00').getTime(), dayKey: '2026-04-15' },
    { id: 'plan-4', topicId: 'eng-lit-001', source: 'suggested', addedAt: new Date('2026-04-15T08:15:00').getTime(), dayKey: '2026-04-15' },
  ]
  s.planDay = '2026-04-15'
  return s
}

export function progressSessionContext(): PersistedState {
  const s = baseState(['cs-aqa', 'bio-aqa'])
  setOfferingExamDate(s, 'cs-aqa', '2026-04-17')
  setOfferingExamDate(s, 'bio-aqa', EXAM_FAR)

  s.sessions = [
    makeSession('cs-001', '2026-04-10', 0.4, 900, new Date('2026-04-10T12:00:00').getTime()),
    makeSession('cs-001', '2026-04-15', 0.75, 1200, new Date('2026-04-15T12:00:00').getTime()),
    makeSession('bio-001', '2026-04-14', 0.54, 800, new Date('2026-04-14T12:00:00').getTime()),
  ]

  setTopicFields(s, 'cs-001', { lastReviewed: '2026-04-15', performanceScore: 0.5, confidence: 3 })
  setTopicFields(s, 'bio-001', { lastReviewed: '2026-03-01', performanceScore: 0.55, confidence: 2 })
  setTopicFields(s, 'cs-003', { lastReviewed: null, performanceScore: 0.35, confidence: 2 })
  setTopicFields(s, 'bio-002', { lastReviewed: '2026-04-12', performanceScore: 0.65, confidence: 3 })

  return s
}

export function progressPaperPractice(): PersistedState {
  const s = baseState(['geo-aqa', 'cs-aqa'])
  setOfferingExamDate(s, 'geo-aqa', '2026-04-20')
  setOfferingExamDate(s, 'cs-aqa', EXAM_FAR)

  s.sessions = [
    makeSession('cs-001', '2026-04-14', 0.66, 1200, new Date('2026-04-14T12:00:00').getTime()),
  ]
  s.paperAttempts = [
    {
      ...makePaperAttempt(
        'geo-p1',
        '2026-04-15',
        2,
        5400,
        38,
        80,
        'Rushed the final 8-mark question and guessed two case-study details.',
        ['geo-001', 'geo-003'],
      ),
      id: 'geo-p1-morning',
      timestamp: new Date('2026-04-15T10:00:00').getTime(),
    },
    {
      ...makePaperAttempt('geo-p1', '2026-04-15', 3, 5400, 47, 80),
      id: 'geo-p1-afternoon',
      timestamp: new Date('2026-04-15T18:00:00').getTime(),
    },
  ]

  setTopicFields(s, 'cs-001', { lastReviewed: '2026-04-14', performanceScore: 0.66, confidence: 3 })

  return s
}

// 8. No weak spots — all topics have high perf, future exams exist
export function progressNoWeakSpots(): PersistedState {
  const s = baseState(['cs-aqa'])
  setOfferingExamDate(s, 'cs-aqa', EXAM_FAR)
  // Review all CS topics with high performance
  const csTopicIds = seed.topics.filter(t => t.offeringId === 'cs-aqa').map(t => t.id)
  for (const tid of csTopicIds) {
    setTopicFields(s, tid, { lastReviewed: '2026-04-14', performanceScore: 0.85, confidence: 4 })
    s.sessions.push(makeSession(tid, '2026-04-14', 0.85, 600))
  }
  return s
}

// 10. Not started expanded — distant exams, 0 topics studied
export function progressNotStartedExpanded(): PersistedState {
  const s = baseState(['phys-aqa'])
  setOfferingExamDate(s, 'phys-aqa', EXAM_FAR)
  return s
}

// 9. No future exams — all papers overridden to past dates
export function progressNoFutureExams(): PersistedState {
  const s = baseState(['cs-aqa', 'bio-aqa'])
  setOfferingExamDate(s, 'cs-aqa', EXAM_PAST)
  setOfferingExamDate(s, 'bio-aqa', EXAM_PAST)
  // Add some sessions so the page isn't empty-state
  s.sessions = [
    makeSession('cs-001', '2026-04-14', 0.7, 900),
    makeSession('bio-001', '2026-04-15', 0.6, 800),
  ]
  setTopicFields(s, 'cs-001', { lastReviewed: '2026-04-14', performanceScore: 0.7 })
  setTopicFields(s, 'bio-001', { lastReviewed: '2026-04-15', performanceScore: 0.6 })
  return s
}
