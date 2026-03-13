import type { PersistedState } from '../helpers/seedAppState'

/**
 * Onboarding CTA test fixtures.
 *
 * These are NOT migration fixtures — they represent valid current-seed states
 * for testing navigation, save/cancel, and CTA wiring.
 */

const BOARDS = [
  { id: 'aqa', name: 'AQA' },
  { id: 'ocr', name: 'OCR' },
]

const SUBJECTS = [
  { id: 'cs', name: 'Computer Science', color: '#3B82F6' },
  { id: 'geo', name: 'Geography', color: '#F59E0B' },
]

const OFFERINGS = [
  { id: 'cs-aqa', subjectId: 'cs', boardId: 'aqa', spec: '8525', label: 'AQA 8525', qualificationId: 'gcse' },
  { id: 'geo-aqa', subjectId: 'geo', boardId: 'aqa', spec: '8035', label: 'AQA 8035', qualificationId: 'gcse' },
]

const PAPERS = [
  { id: 'cs-p1', offeringId: 'cs-aqa', name: 'Paper 1', examDate: '2026-05-13', examTime: '13:30' },
  { id: 'cs-p2', offeringId: 'cs-aqa', name: 'Paper 2', examDate: '2026-05-19', examTime: '13:30' },
  { id: 'geo-p1', offeringId: 'geo-aqa', name: 'Paper 1', examDate: '2026-05-13', examTime: '09:00' },
  { id: 'geo-p2', offeringId: 'geo-aqa', name: 'Paper 2', examDate: '2026-06-03', examTime: '13:30' },
  { id: 'geo-p3', offeringId: 'geo-aqa', name: 'Paper 3', examDate: '2026-06-11', examTime: '09:00' },
]

const CS_TOPICS = [
  { id: 'cs-001', paperId: 'cs-p1', offeringId: 'cs-aqa', name: 'Sorting and searching algorithms', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'cs-002', paperId: 'cs-p1', offeringId: 'cs-aqa', name: 'Pseudo-code', confidence: 4, performanceScore: 0.7, lastReviewed: '2026-03-10' },
  { id: 'cs-003', paperId: 'cs-p1', offeringId: 'cs-aqa', name: 'Flowcharts', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'cs-009', paperId: 'cs-p2', offeringId: 'cs-aqa', name: 'Data representation', confidence: 3, performanceScore: 0.5, lastReviewed: null },
]

const GEO_TOPICS = [
  { id: 'geo-001', paperId: 'geo-p1', offeringId: 'geo-aqa', name: 'Tectonic hazards and climate change', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'geo-004', paperId: 'geo-p2', offeringId: 'geo-aqa', name: 'Urban issues', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'geo-009', paperId: 'geo-p3', offeringId: 'geo-aqa', name: 'Unseen evaluation', confidence: 3, performanceScore: 0.5, lastReviewed: null },
]

// ── Factories ──

/** Fresh user: triggers landing → qualification picker → onboarding */
export function freshState(): PersistedState {
  return {
    version: 2,
    boards: [],
    subjects: [],
    offerings: [],
    papers: [],
    topics: [],
    sessions: [],
    notes: [],
    userState: { energyLevel: 3, stress: 2 },
    onboarded: false,
    selectedOfferingIds: [],
    dailyPlan: [],
    planDay: '',
    studyMode: null,
  }
}

/** Returning user with one configured non-tiered subject (CS AQA) */
export function returningSimpleState(): PersistedState {
  return {
    version: 2,
    boards: JSON.parse(JSON.stringify(BOARDS)),
    subjects: [SUBJECTS[0]],
    offerings: [OFFERINGS[0]],
    papers: PAPERS.filter(p => p.offeringId === 'cs-aqa'),
    topics: JSON.parse(JSON.stringify(CS_TOPICS)),
    sessions: [
      { id: 'sess-cs-1', topicId: 'cs-002', date: '2026-03-10', score: 0.7, timestamp: new Date('2026-03-10T12:00:00').getTime() },
    ],
    notes: [],
    userState: { energyLevel: 3, stress: 2 },
    onboarded: true,
    selectedOfferingIds: ['cs-aqa'],
    dailyPlan: [],
    planDay: '',
    studyMode: 'gcse',
  }
}

/** Returning user with two subjects: CS (fully configured) + Geo (fully configured) */
export function returningMultiState(): PersistedState {
  return {
    version: 2,
    boards: JSON.parse(JSON.stringify(BOARDS)),
    subjects: JSON.parse(JSON.stringify(SUBJECTS)),
    offerings: JSON.parse(JSON.stringify(OFFERINGS)),
    papers: JSON.parse(JSON.stringify(PAPERS)),
    topics: [...JSON.parse(JSON.stringify(CS_TOPICS)), ...JSON.parse(JSON.stringify(GEO_TOPICS))],
    sessions: [
      { id: 'sess-cs-1', topicId: 'cs-002', date: '2026-03-10', score: 0.7, timestamp: new Date('2026-03-10T12:00:00').getTime() },
    ],
    notes: [],
    userState: { energyLevel: 3, stress: 2 },
    onboarded: true,
    selectedOfferingIds: ['cs-aqa', 'geo-aqa'],
    dailyPlan: [],
    planDay: '',
    studyMode: 'gcse',
  }
}
