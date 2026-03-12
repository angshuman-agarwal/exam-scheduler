import type { PersistedState } from '../helpers/seedAppState'

/**
 * Pre-migration state fixtures.
 *
 * These emulate what the app stored BEFORE the tier-split migration
 * (seedRevision 3). The old seed had unsplit offerings like `maths-aqa`
 * and `bio-aqa`, and paper IDs like `maths-aqa-p1` and `bio-p1`.
 *
 * When the app loads this state it will detect `seedRevision < SEED_REVISION`,
 * call `mergeWithFreshSeed`, and run `computeCompatState` to populate
 * `pendingTierConfirmations`.
 */

// ── Old seed entries (fabricated; the real old seed is gone) ──

const OLD_BOARDS = [
  { id: 'aqa', name: 'AQA' },
  { id: 'edexcel', name: 'Edexcel' },
  { id: 'ocr', name: 'OCR' },
]

const OLD_SUBJECTS = [
  { id: 'maths', name: 'Maths', color: '#EF4444' },
  { id: 'bio', name: 'Biology', color: '#10B981' },
  { id: 'cs', name: 'Computer Science', color: '#3B82F6' },
]

// Old unsplit offerings — these are keys in TIER_SPLIT_MAP
const OLD_OFFERINGS = [
  { id: 'maths-aqa', subjectId: 'maths', boardId: 'aqa', spec: '8300', label: 'AQA 8300', qualificationId: 'gcse' },
  { id: 'bio-aqa', subjectId: 'bio', boardId: 'aqa', spec: '8461', label: 'AQA 8461', qualificationId: 'gcse' },
  // CS was never tier-split — same ID as current seed
  { id: 'cs-aqa', subjectId: 'cs', boardId: 'aqa', spec: '8525', label: 'AQA 8525', qualificationId: 'gcse' },
]

// Old unsplit papers — these are keys in PAPER_SPLIT_MAP (except cs)
const OLD_PAPERS = [
  { id: 'maths-aqa-p1', offeringId: 'maths-aqa', name: 'Paper 1 (Non-calculator)', examDate: '2026-05-19', examTime: '09:00' },
  { id: 'maths-aqa-p2', offeringId: 'maths-aqa', name: 'Paper 2 (Calculator)', examDate: '2026-06-04', examTime: '09:00' },
  { id: 'maths-aqa-p3', offeringId: 'maths-aqa', name: 'Paper 3 (Calculator)', examDate: '2026-06-11', examTime: '09:00' },
  { id: 'bio-p1', offeringId: 'bio-aqa', name: 'Paper 1', examDate: '2026-05-12', examTime: '09:00' },
  { id: 'bio-p2', offeringId: 'bio-aqa', name: 'Paper 2', examDate: '2026-06-09', examTime: '09:00' },
  // CS papers are the same as the current seed
  { id: 'cs-p1', offeringId: 'cs-aqa', name: 'Paper 1', examDate: '2026-05-14', examTime: '13:30' },
  { id: 'cs-p2', offeringId: 'cs-aqa', name: 'Paper 2', examDate: '2026-06-12', examTime: '09:00' },
]

/**
 * Old topics — names match the current seed exactly so that
 * `mergeWithFreshSeed` can match them via `normalizeTopic(name) + offeringId + paperId`.
 *
 * Maths AQA topics (matched to maths-aqa-f / maths-aqa-h in current seed):
 *   Paper 1: Fractions decimals and percentages, Indices and standard form, Surds,
 *            Ratio and proportion, Algebra and equations, Sequences
 *   Paper 2: Geometry and measures, Trigonometry, Vectors
 *   Paper 3: Statistics and probability
 *
 * Bio AQA topics (matched to bio-aqa-f / bio-aqa-h in current seed):
 *   Paper 1: Cells tissues organs, Animal and plant organisation, Cell division,
 *            Digestive system, Breathing and circulatory system, Plants and bioenergetics,
 *            Health and disease
 *   Paper 2: Homeostasis, Ecology, Evolution and genetics
 *
 * CS AQA topics (same IDs as current seed — cs wasn't split):
 *   Paper 1: Sorting and searching algorithms, Pseudo-code, Flowcharts, Random number
 *            generation, Arrays, Records, File handling, Subroutines
 *   Paper 2: Data representation (+ more, but we only need a few for fixtures)
 */

const OLD_MATHS_TOPICS = [
  // Paper 1
  { id: 'old-maths-001', paperId: 'maths-aqa-p1', offeringId: 'maths-aqa', name: 'Fractions, decimals and percentages', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'old-maths-002', paperId: 'maths-aqa-p1', offeringId: 'maths-aqa', name: 'Indices and standard form', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'old-maths-003', paperId: 'maths-aqa-p1', offeringId: 'maths-aqa', name: 'Surds', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'old-maths-004', paperId: 'maths-aqa-p1', offeringId: 'maths-aqa', name: 'Ratio and proportion', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'old-maths-005', paperId: 'maths-aqa-p1', offeringId: 'maths-aqa', name: 'Algebra and equations', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'old-maths-006', paperId: 'maths-aqa-p1', offeringId: 'maths-aqa', name: 'Sequences', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  // Paper 2
  { id: 'old-maths-007', paperId: 'maths-aqa-p2', offeringId: 'maths-aqa', name: 'Geometry and measures', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'old-maths-008', paperId: 'maths-aqa-p2', offeringId: 'maths-aqa', name: 'Trigonometry', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'old-maths-009', paperId: 'maths-aqa-p2', offeringId: 'maths-aqa', name: 'Vectors', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  // Paper 3
  { id: 'old-maths-010', paperId: 'maths-aqa-p3', offeringId: 'maths-aqa', name: 'Statistics and probability', confidence: 3, performanceScore: 0.5, lastReviewed: null },
]

const OLD_BIO_TOPICS = [
  // Paper 1
  { id: 'old-bio-001', paperId: 'bio-p1', offeringId: 'bio-aqa', name: 'Cells tissues organs', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'old-bio-002', paperId: 'bio-p1', offeringId: 'bio-aqa', name: 'Animal and plant organisation', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'old-bio-003', paperId: 'bio-p1', offeringId: 'bio-aqa', name: 'Cell division', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'old-bio-004', paperId: 'bio-p1', offeringId: 'bio-aqa', name: 'Digestive system', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'old-bio-005', paperId: 'bio-p1', offeringId: 'bio-aqa', name: 'Breathing and circulatory system', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'old-bio-006', paperId: 'bio-p1', offeringId: 'bio-aqa', name: 'Plants and bioenergetics', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'old-bio-007', paperId: 'bio-p1', offeringId: 'bio-aqa', name: 'Health and disease', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  // Paper 2
  { id: 'old-bio-008', paperId: 'bio-p2', offeringId: 'bio-aqa', name: 'Homeostasis', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'old-bio-009', paperId: 'bio-p2', offeringId: 'bio-aqa', name: 'Ecology', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'old-bio-010', paperId: 'bio-p2', offeringId: 'bio-aqa', name: 'Evolution and genetics', confidence: 3, performanceScore: 0.5, lastReviewed: null },
]

// Re-use current CS topic IDs/names (cs-aqa wasn't tier-split)
const OLD_CS_TOPICS = [
  { id: 'cs-001', paperId: 'cs-p1', offeringId: 'cs-aqa', name: 'Sorting and searching algorithms', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'cs-002', paperId: 'cs-p1', offeringId: 'cs-aqa', name: 'Pseudo-code', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'cs-003', paperId: 'cs-p1', offeringId: 'cs-aqa', name: 'Flowcharts', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'cs-004', paperId: 'cs-p1', offeringId: 'cs-aqa', name: 'Random number generation', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'cs-005', paperId: 'cs-p1', offeringId: 'cs-aqa', name: 'Arrays', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'cs-006', paperId: 'cs-p1', offeringId: 'cs-aqa', name: 'Records', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'cs-007', paperId: 'cs-p1', offeringId: 'cs-aqa', name: 'File handling', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'cs-008', paperId: 'cs-p1', offeringId: 'cs-aqa', name: 'Subroutines', confidence: 3, performanceScore: 0.5, lastReviewed: null },
  { id: 'cs-009', paperId: 'cs-p2', offeringId: 'cs-aqa', name: 'Data representation', confidence: 3, performanceScore: 0.5, lastReviewed: null },
]

// ── Helpers ──

function makeSession(topicId: string, date: string, score: number, durationSeconds?: number) {
  return {
    id: `mig-${topicId}-${date}`,
    topicId,
    date,
    score,
    timestamp: new Date(date + 'T12:00:00').getTime(),
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
  }
}

function makeNote(id: string, topicId: string, date: string, text: string) {
  return { id, topicId, date, text }
}

// ── Fixtures ──

/**
 * Old state with maths-aqa selected.
 * Includes sessions and notes on old maths topics so we can verify
 * that progress is preserved through the migration path.
 */
export function migrationMathsAqa(): PersistedState {
  const topics = [...OLD_MATHS_TOPICS].map(t => ({ ...t }))

  // Simulate user study: reviewed 3 topics with updated confidence/perf
  topics[0].confidence = 4
  topics[0].performanceScore = 0.8
  topics[0].lastReviewed = '2026-03-10'

  topics[1].confidence = 2
  topics[1].performanceScore = 0.4
  topics[1].lastReviewed = '2026-03-11'

  topics[2].confidence = 3
  topics[2].performanceScore = 0.65
  topics[2].lastReviewed = '2026-03-12'

  return {
    version: 2,
    seedRevision: 3,
    boards: JSON.parse(JSON.stringify(OLD_BOARDS)),
    subjects: [OLD_SUBJECTS[0]], // maths only
    offerings: [OLD_OFFERINGS[0]], // maths-aqa
    papers: OLD_PAPERS.filter(p => p.offeringId === 'maths-aqa'),
    topics,
    sessions: [
      makeSession('old-maths-001', '2026-03-10', 0.8, 1200),
      makeSession('old-maths-002', '2026-03-11', 0.4, 900),
      makeSession('old-maths-003', '2026-03-12', 0.65, 1100),
    ],
    notes: [
      makeNote('mig-n1', 'old-maths-001', '2026-03-10', 'Remember to simplify fractions first'),
      makeNote('mig-n2', 'old-maths-002', '2026-03-11', 'Review negative indices'),
    ],
    userState: { energyLevel: 3, stress: 2 },
    onboarded: true,
    selectedOfferingIds: ['maths-aqa'],
    dailyPlan: [],
    planDay: '',
    studyMode: 'gcse',
  }
}

/**
 * Old state with maths-aqa + bio-aqa + cs-aqa selected.
 * Sessions are spread across subjects.
 * CS topics use current IDs (cs-aqa wasn't tier-split).
 */
/**
 * Old Maths AQA state + a custom offering (custom OCR).
 * Verifies that custom offerings survive migration.
 */
export function migrationWithCustomOffering(): PersistedState {
  const base = migrationMathsAqa()
  return {
    ...base,
    customBoards: [{ id: 'custom-board-1', name: 'Custom Board' }],
    customSubjects: [{ id: 'custom-subject-1', name: 'Art', color: '#8B5CF6' }],
    customOfferings: [{
      id: 'custom-offering-1',
      subjectId: 'custom-subject-1',
      boardId: 'custom-board-1',
      spec: 'ART01',
      label: 'Custom Board ART01',
      qualificationId: 'gcse',
    }],
    customPapers: [{
      id: 'custom-paper-1',
      offeringId: 'custom-offering-1',
      name: 'Component 1',
      examDate: '2026-06-10',
      examTime: '09:00',
    }],
    customTopics: [{
      id: 'custom-topic-1',
      paperId: 'custom-paper-1',
      offeringId: 'custom-offering-1',
      name: 'Portraiture',
      confidence: 3,
      performanceScore: 0.5,
      lastReviewed: null,
    }],
    selectedOfferingIds: ['maths-aqa', 'custom-offering-1'],
  }
}

export function migrationMultiSubject(): PersistedState {
  const mathsTopics = [...OLD_MATHS_TOPICS].map(t => ({ ...t }))
  const bioTopics = [...OLD_BIO_TOPICS].map(t => ({ ...t }))
  const csTopics = [...OLD_CS_TOPICS].map(t => ({ ...t }))

  // Some user study across subjects
  mathsTopics[0].confidence = 4
  mathsTopics[0].performanceScore = 0.75
  mathsTopics[0].lastReviewed = '2026-03-09'

  bioTopics[0].confidence = 3
  bioTopics[0].performanceScore = 0.6
  bioTopics[0].lastReviewed = '2026-03-10'

  csTopics[0].confidence = 4
  csTopics[0].performanceScore = 0.85
  csTopics[0].lastReviewed = '2026-03-11'

  return {
    version: 2,
    seedRevision: 3,
    boards: JSON.parse(JSON.stringify(OLD_BOARDS)),
    subjects: JSON.parse(JSON.stringify(OLD_SUBJECTS)),
    offerings: JSON.parse(JSON.stringify(OLD_OFFERINGS)),
    papers: JSON.parse(JSON.stringify(OLD_PAPERS)),
    topics: [...mathsTopics, ...bioTopics, ...csTopics],
    sessions: [
      makeSession('old-maths-001', '2026-03-09', 0.75, 1000),
      makeSession('old-bio-001', '2026-03-10', 0.6, 800),
      makeSession('cs-001', '2026-03-11', 0.85, 1300),
    ],
    notes: [
      makeNote('mig-n3', 'old-maths-001', '2026-03-09', 'Practice converting between fractions and decimals'),
      makeNote('mig-n4', 'old-bio-001', '2026-03-10', 'Draw and label cell diagrams'),
    ],
    userState: { energyLevel: 3, stress: 2 },
    onboarded: true,
    selectedOfferingIds: ['maths-aqa', 'bio-aqa', 'cs-aqa'],
    dailyPlan: [],
    planDay: '',
    studyMode: 'gcse',
  }
}
