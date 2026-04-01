import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../lib/idb', () => ({
  loadFromIdbRaw: vi.fn(),
  saveToIdbRaw: vi.fn(),
}))
import { useAppStore } from './app.store'
import type { Board, Offering, Paper, PaperAttempt, Subject, Topic } from '../types'

const boards: Board[] = [{ id: 'aqa', name: 'AQA' }]
const subjects: Subject[] = [{ id: 'cs', name: 'Computer Science', color: '#2563eb' }]
const offerings: Offering[] = [
  {
    id: 'custom-offering-cs',
    subjectId: 'cs',
    boardId: 'aqa',
    spec: '8525',
    label: 'AQA 8525',
    qualificationId: 'gcse',
  },
]
const papers: Paper[] = [
  { id: 'paper-1', offeringId: 'custom-offering-cs', name: 'Paper 1', examDate: '2026-05-20' },
]
const topics: Topic[] = [
  {
    id: 'topic-1',
    paperId: 'paper-1',
    offeringId: 'custom-offering-cs',
    name: 'Arrays',
    confidence: 4,
    performanceScore: 0.8,
    lastReviewed: null,
  },
  {
    id: 'topic-2',
    paperId: 'paper-1',
    offeringId: 'custom-offering-cs',
    name: 'Flowcharts',
    confidence: 1,
    performanceScore: 0.4,
    lastReviewed: null,
  },
  {
    id: 'topic-3',
    paperId: 'paper-2',
    offeringId: 'custom-offering-cs',
    name: 'Not in this paper',
    confidence: 5,
    performanceScore: 0.9,
    lastReviewed: null,
  },
]

function resetStore(overrides?: { paperAttempts?: PaperAttempt[] }) {
  useAppStore.setState({
    version: 2,
    seedRevision: 1,
    boards,
    subjects,
    offerings,
    papers,
    topics,
    sessions: [],
    paperAttempts: overrides?.paperAttempts ?? [],
    notes: [],
    userState: { energyLevel: 3, stress: 2 },
    onboarded: true,
    initialized: true,
    selectedOfferingIds: ['custom-offering-cs'],
    dailyPlan: [],
    planDay: '',
    studyMode: 'gcse',
    customBoards: [],
    customSubjects: [],
    customOfferings: offerings,
    customPapers: papers,
    customTopics: topics,
  })
}

describe('useAppStore paper attempts', () => {
  beforeEach(() => {
    resetStore()
  })

  test('logPaperAttempt stores an attempt and updates only tagged topics', () => {
    const today = new Date('2026-04-15T12:00:00')

    useAppStore.getState().logPaperAttempt(
      'paper-1',
      today,
      3600,
      3,
      ['topic-1', 'topic-2'],
      'picker',
      47,
      80,
      'Need more timed practice',
    )

    const state = useAppStore.getState()
    expect(state.paperAttempts).toHaveLength(1)
    expect(state.paperAttempts[0]).toMatchObject({
      paperId: 'paper-1',
      durationSeconds: 3600,
      confidence: 3,
      rawMark: 47,
      totalMarks: 80,
      noteText: 'Need more timed practice',
      taggedTopicIds: ['topic-1', 'topic-2'],
      source: 'picker',
    })

    expect(state.topics.find((topic) => topic.id === 'topic-1')).toMatchObject({
      confidence: 3,
      performanceScore: 0.8,
      lastReviewed: '2026-04-15',
    })
    expect(state.topics.find((topic) => topic.id === 'topic-2')).toMatchObject({
      confidence: 1,
      performanceScore: 0.4,
      lastReviewed: '2026-04-15',
    })
    expect(state.topics.find((topic) => topic.id === 'topic-3')).toMatchObject({
      confidence: 5,
      performanceScore: 0.9,
      lastReviewed: null,
    })
  })

  test('logPaperAttempt ignores tagged topics that do not belong to the selected paper', () => {
    const today = new Date('2026-04-16T12:00:00')

    useAppStore.getState().logPaperAttempt('paper-1', today, 1800, 4, ['topic-3'], 'calendar')

    const state = useAppStore.getState()
    expect(state.paperAttempts).toHaveLength(1)
    expect(state.paperAttempts[0].taggedTopicIds).toBeUndefined()
    expect(state.topics.find((topic) => topic.id === 'topic-3')?.lastReviewed).toBeNull()
  })

  test('getOfferingCascadeCounts includes paperAttemptCount', () => {
    resetStore({
      paperAttempts: [
        {
          id: 'attempt-1',
          paperId: 'paper-1',
          date: '2026-04-15',
          timestamp: new Date('2026-04-15T12:00:00').getTime(),
          durationSeconds: 3600,
          confidence: 3,
          source: 'today-suggestion',
        },
      ],
    })

    expect(useAppStore.getState().getOfferingCascadeCounts('custom-offering-cs')).toMatchObject({
      topicCount: 3,
      paperAttemptCount: 1,
    })
  })
})
