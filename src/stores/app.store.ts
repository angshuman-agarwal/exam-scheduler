import { create } from 'zustand'
import type { Topic, Paper, Subject, Board, Offering, Session, ScoredTopic, DayPlan, UserState, Note, ScheduleItem, ScheduleSource, SeedDataV2 } from '../types'
import { scoreAllTopics, buildDayPlan, updatePerformance, adjustConfidence, autoFillPlanItems, TOTAL_BLOCKS, getPlanningMode } from '../lib/engine'
import { getLocalDayKey } from '../lib/date'
import { loadFromIdbRaw, saveToIdbRaw } from '../lib/idb'
import seedData from '../data/subjects.json'

const STATE_KEY = 'app'

const seed = seedData as SeedDataV2

import { SEED_REVISION } from '../lib/constants'

// Color palette for custom subjects
const CUSTOM_COLORS = ['#E11D48','#7C3AED','#0891B2','#CA8A04','#059669',
                        '#DC2626','#4F46E5','#0D9488','#C026D3','#EA580C']
function pickUnusedColor(subjects: Subject[]): string {
  const used = new Set(subjects.map(s => s.color))
  return CUSTOM_COLORS.find(c => !used.has(c)) ?? CUSTOM_COLORS[0]
}

interface PersistedState {
  version: 2
  seedRevision?: number
  boards: Board[]
  subjects: Subject[]
  offerings: Offering[]
  papers: Paper[]
  topics: Topic[]
  sessions: Session[]
  notes: Note[]
  userState: UserState
  onboarded: boolean
  selectedOfferingIds: string[]
  dailyPlan: ScheduleItem[]
  planDay: string
  studyMode: 'gcse' | 'alevel' | null
  customBoards: Board[]
  customSubjects: Subject[]
  customOfferings: Offering[]
  customPapers: Paper[]
  customTopics: Topic[]
}

interface AppState extends PersistedState {
  initialized: boolean
  init: () => Promise<void>
  logSession: (topicId: string, rawScore: number, today: Date, durationSeconds?: number, source?: ScheduleSource) => void
  setEnergy: (level: number) => void
  setStress: (level: number) => void
  getDayPlan: (today: Date) => DayPlan
  getAllTopicsScored: (today: Date) => ScoredTopic[]
  completeOnboarding: (offeringIds: string[], confidences: Map<string, number>) => void
  updateSelectedOfferings: (offeringIds: string[], confidences: Map<string, number>) => void
  addNote: (topicId: string, text: string) => void
  getTopicsForOffering: (offeringId: string, today: Date) => ScoredTopic[]
  resetAll: () => Promise<void>
  addToPlan: (topicId: string, source: ScheduleSource, today: Date) => void
  removeFromPlan: (id: string) => void
  clearPlan: () => void
  autoFillPlan: (today: Date) => void
  getPlanItems: (today: Date) => ScheduleItem[]
  setStudyMode: (mode: 'gcse' | 'alevel') => void
  addCustomSubject: (data: {
    subjectName: string
    boardId: 'aqa' | 'ccea' | 'eduqas' | 'edexcel' | 'ocr' | 'wjec' | 'other'
    customBoardName?: string
    spec?: string
    papers: { name: string; examDate: string; examTime?: string }[]
    topicNames: string[]
    confidence: number
    qualificationId: 'gcse' | 'alevel'
  }) => { subjectId: string; offeringId: string }
  removeCustomSubject: (subjectId: string) => void
}

function deepCloneSeed(): PersistedState {
  return {
    version: 2,
    seedRevision: SEED_REVISION,
    boards: JSON.parse(JSON.stringify(seed.boards)) as Board[],
    subjects: JSON.parse(JSON.stringify(seed.subjects)) as Subject[],
    offerings: JSON.parse(JSON.stringify(seed.offerings)) as Offering[],
    papers: JSON.parse(JSON.stringify(seed.papers)) as Paper[],
    topics: JSON.parse(JSON.stringify(seed.topics)) as Topic[],
    sessions: [],
    notes: [],
    userState: { energyLevel: 3, stress: 2 },
    onboarded: false,
    selectedOfferingIds: [],
    dailyPlan: [],
    planDay: '',
    studyMode: null,
    customBoards: [],
    customSubjects: [],
    customOfferings: [],
    customPapers: [],
    customTopics: [],
  }
}

function hasValidSchema(data: unknown): data is PersistedState {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return d.version === 2 && Array.isArray(d.offerings) && Array.isArray(d.boards)
}

function isSeedCurrent(data: PersistedState): boolean {
  return data.seedRevision === SEED_REVISION
}

function mergeWithFreshSeed(saved: PersistedState, fresh: PersistedState): PersistedState {
  // 1. Existing seed topic merge (preserve user-owned fields)
  const oldTopicMap = new Map(saved.topics.map((t) => [t.id, t]))
  const mergedSeedTopics = fresh.topics.map((t) => {
    const old = oldTopicMap.get(t.id)
    if (!old) return t
    return {
      ...t,
      confidence: old.confidence,
      performanceScore: old.performanceScore,
      lastReviewed: old.lastReviewed,
    }
  })

  // 2. Extract custom entities from saved state
  const customBoards = saved.customBoards ?? []
  const customSubjects = saved.customSubjects ?? []
  const customOfferings = saved.customOfferings ?? []
  const customPapers = saved.customPapers ?? []
  const customTopics = saved.customTopics ?? []

  // 3. Build merged arrays: fresh seed base + custom entities (appended once)
  const boards = [...fresh.boards, ...customBoards]
  const subjects = [...fresh.subjects, ...customSubjects]
  const offerings = [...fresh.offerings, ...customOfferings]
  const papers = [...fresh.papers, ...customPapers]
  const topics = [...mergedSeedTopics, ...customTopics]

  // 4. Build valid ID sets from merged arrays (seed + custom)
  const validOfferingIds = new Set(offerings.map((o) => o.id))
  const validTopicIds = new Set(topics.map((t) => t.id))

  // 5. Filter user selections/data — preserve exactly, only remove invalid
  const selectedOfferingIds = saved.selectedOfferingIds.filter((id) => validOfferingIds.has(id))
  const onboarded = selectedOfferingIds.length > 0 ? saved.onboarded : false
  const sessions = saved.sessions.filter((s) => validTopicIds.has(s.topicId))
  const notes = saved.notes.filter((n) => validTopicIds.has(n.topicId))
  const dailyPlan = saved.dailyPlan.filter((i) => validTopicIds.has(i.topicId))

  // 6. Carry forward studyMode and custom arrays
  return {
    version: 2,
    seedRevision: SEED_REVISION,
    boards,
    subjects,
    offerings,
    papers,
    topics,
    sessions,
    notes,
    userState: saved.userState,
    onboarded,
    selectedOfferingIds,
    dailyPlan,
    planDay: saved.planDay,
    studyMode: saved.studyMode ?? null,
    customBoards,
    customSubjects,
    customOfferings,
    customPapers,
    customTopics,
  }
}

async function loadFromIdb(): Promise<{ state: PersistedState; needsMerge: boolean } | null> {
  const data = await loadFromIdbRaw<PersistedState>(STATE_KEY)
  if (!hasValidSchema(data)) return null
  return { state: data, needsMerge: !isSeedCurrent(data) }
}

async function saveToIdb(state: PersistedState): Promise<void> {
  await saveToIdbRaw(STATE_KEY, state)
}

function extractPersisted(state: AppState): PersistedState {
  return {
    version: 2,
    seedRevision: SEED_REVISION,
    boards: state.boards,
    subjects: state.subjects,
    offerings: state.offerings,
    papers: state.papers,
    topics: state.topics,
    sessions: state.sessions,
    notes: state.notes,
    userState: state.userState,
    onboarded: state.onboarded,
    selectedOfferingIds: state.selectedOfferingIds,
    dailyPlan: state.dailyPlan,
    planDay: state.planDay,
    studyMode: state.studyMode,
    customBoards: state.boards.filter(b => b.id.startsWith('custom-board-')),
    customSubjects: state.subjects.filter(s => s.id.startsWith('custom-subject-')),
    customOfferings: state.offerings.filter(o => o.id.startsWith('custom-offering-')),
    customPapers: state.papers.filter(p => p.id.startsWith('custom-paper-')),
    customTopics: state.topics.filter(t => t.id.startsWith('custom-topic-')),
  }
}

// Filter topics/papers to only selected offerings
function selectedTopics(state: { topics: Topic[]; selectedOfferingIds: string[] }): Topic[] {
  const ids = new Set(state.selectedOfferingIds)
  return state.topics.filter((t) => ids.has(t.offeringId))
}

function selectedPapers(state: { papers: Paper[]; selectedOfferingIds: string[] }): Paper[] {
  const ids = new Set(state.selectedOfferingIds)
  return state.papers.filter((p) => ids.has(p.offeringId))
}

function selectedOfferings(state: { offerings: Offering[]; selectedOfferingIds: string[] }): Offering[] {
  const ids = new Set(state.selectedOfferingIds)
  return state.offerings.filter((o) => ids.has(o.id))
}

export const useAppStore = create<AppState>()((set, get) => ({
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
  initialized: false,
  selectedOfferingIds: [],
  dailyPlan: [],
  planDay: '',
  studyMode: null,
  customBoards: [],
  customSubjects: [],
  customOfferings: [],
  customPapers: [],
  customTopics: [],

  init: async () => {
    const loaded = await loadFromIdb()

    let state: PersistedState
    if (!loaded) {
      state = deepCloneSeed()
    } else if (loaded.needsMerge) {
      state = mergeWithFreshSeed(loaded.state, deepCloneSeed())
    } else {
      state = loaded.state
    }

    // Backfill qualificationId on offerings from fresh seed (handles stale IDB at current revision)
    const freshSeed = deepCloneSeed()
    const freshOfferingMap = new Map(freshSeed.offerings.map(o => [o.id, o]))
    for (const o of state.offerings) {
      if (!o.qualificationId) {
        const fresh = freshOfferingMap.get(o.id)
        if (fresh) o.qualificationId = fresh.qualificationId
      }
    }

    // Validate studyMode
    if (state.studyMode !== 'gcse' && state.studyMode !== 'alevel') {
      state.studyMode = null
    }

    // Backfill custom arrays
    if (!state.customBoards) state.customBoards = []
    if (!state.customSubjects) state.customSubjects = []
    if (!state.customOfferings) state.customOfferings = []
    if (!state.customPapers) state.customPapers = []
    if (!state.customTopics) state.customTopics = []

    // Backfill optional fields from older persisted states
    if (!state.dailyPlan) state.dailyPlan = []
    if (!state.planDay) state.planDay = ''
    if (!state.selectedOfferingIds) state.selectedOfferingIds = []

    // Auto-detect studyMode for existing onboarded users
    if (state.studyMode === null && state.onboarded && state.selectedOfferingIds.length > 0) {
      const offeringQuals = state.selectedOfferingIds.map(id => {
        const o = state.offerings.find(o => o.id === id)
        return o?.qualificationId
      })
      const allGcse = offeringQuals.length > 0 && offeringQuals.every(q => q === 'gcse')
      const allAlevel = offeringQuals.length > 0 && offeringQuals.every(q => q === 'alevel')
      if (allGcse) {
        state.studyMode = 'gcse'
      } else if (allAlevel) {
        state.studyMode = 'alevel'
      } else {
        // Mixed or unknown — cannot auto-resolve. Drop selections, force re-setup.
        state.selectedOfferingIds = []
        state.dailyPlan = []
        state.planDay = ''
        state.onboarded = false
      }
    }

    // Corrupted state guard: onboarded but no selections — full reset to qualification picker
    if (state.onboarded && state.selectedOfferingIds.length === 0) {
      state.onboarded = false
      state.studyMode = null
    }

    // Plan-day cleanup
    const today = getLocalDayKey(new Date())
    if (state.planDay && state.planDay !== today) {
      const hasSessionsOnPlanDay = state.sessions.some((s) => s.date === state.planDay)
      if (hasSessionsOnPlanDay) {
        state.dailyPlan = []
      }
      state.planDay = today
    }

    set({ ...state, initialized: true })
    await saveToIdb(state)
  },

  logSession: (topicId: string, rawScore: number, today: Date, durationSeconds?: number, source?: ScheduleSource) => {
    const normalizedScore = rawScore / 100
    const state = get()
    const topicIndex = state.topics.findIndex((t) => t.id === topicId)
    if (topicIndex === -1) return

    const topic = state.topics[topicIndex]
    const newPerf = updatePerformance(topic.performanceScore, normalizedScore)
    const newConf = adjustConfidence(topic.confidence, normalizedScore)
    const todayISO = getLocalDayKey(today)

    const updatedTopics = [...state.topics]
    updatedTopics[topicIndex] = {
      ...topic,
      performanceScore: newPerf,
      confidence: newConf,
      lastReviewed: todayISO,
    }

    const newSession: Session = {
      id: `${topicId}-${Date.now()}`,
      topicId,
      date: todayISO,
      score: normalizedScore,
      timestamp: Date.now(),
      ...(durationSeconds !== undefined ? { durationSeconds } : {}),
      ...(source !== undefined ? { source } : {}),
    }

    const newState = {
      topics: updatedTopics,
      sessions: [...state.sessions, newSession],
    }

    set(newState)
    saveToIdb(extractPersisted({ ...get() }))
  },

  setEnergy: (level: number) => {
    set({ userState: { ...get().userState, energyLevel: level } })
    saveToIdb(extractPersisted(get()))
  },

  setStress: (level: number) => {
    set({ userState: { ...get().userState, stress: level } })
    saveToIdb(extractPersisted(get()))
  },

  getDayPlan: (today: Date): DayPlan => {
    const state = get()
    const t = selectedTopics(state)
    const p = selectedPapers(state)
    const o = selectedOfferings(state)
    const mode = getPlanningMode(today, p)
    const scored = scoreAllTopics(t, p, o, state.subjects, today, mode)
    return buildDayPlan(scored, state.userState, today, mode)
  },

  getAllTopicsScored: (today: Date): ScoredTopic[] => {
    const state = get()
    const t = selectedTopics(state)
    const p = selectedPapers(state)
    const o = selectedOfferings(state)
    const mode = getPlanningMode(today, p)
    return scoreAllTopics(t, p, o, state.subjects, today, mode)
  },

  completeOnboarding: (offeringIds: string[], confidences: Map<string, number>) => {
    const state = get()
    const kept = new Set(offeringIds)

    const topics = state.topics.map((t) => {
      if (!kept.has(t.offeringId)) return t
      const conf = confidences.get(t.offeringId)
      return conf !== undefined ? { ...t, confidence: conf } : t
    })

    set({ topics, selectedOfferingIds: offeringIds, onboarded: true })
    saveToIdb(extractPersisted(get()))
  },

  updateSelectedOfferings: (offeringIds: string[], confidences: Map<string, number>) => {
    const state = get()
    const previouslySelected = new Set(state.selectedOfferingIds)

    const topics = state.topics.map((t) => {
      if (!offeringIds.includes(t.offeringId)) return t
      if (previouslySelected.has(t.offeringId)) return t
      const conf = confidences.get(t.offeringId)
      return conf !== undefined ? { ...t, confidence: conf } : t
    })

    set({ topics, selectedOfferingIds: offeringIds })
    saveToIdb(extractPersisted(get()))
  },

  addNote: (topicId: string, text: string) => {
    const note: Note = {
      id: `note-${Date.now()}`,
      topicId,
      date: getLocalDayKey(new Date()),
      text,
    }
    set({ notes: [...get().notes, note] })
    saveToIdb(extractPersisted(get()))
  },

  getTopicsForOffering: (offeringId: string, today: Date): ScoredTopic[] => {
    const state = get()
    const offeringTopics = state.topics.filter((t) => t.offeringId === offeringId)
    const offeringPapers = state.papers.filter((p) => p.offeringId === offeringId)
    const offering = state.offerings.filter((o) => o.id === offeringId)
    const mode = getPlanningMode(today, selectedPapers(state))
    const scored = scoreAllTopics(offeringTopics, offeringPapers, offering, state.subjects, today, mode)
    return scored.sort((a, b) => b.score - a.score)
  },

  addToPlan: (topicId: string, source: ScheduleSource, today: Date) => {
    const state = get()
    const dayKey = getLocalDayKey(today)
    const currentItems = state.planDay === dayKey ? state.dailyPlan : []
    if (currentItems.length >= TOTAL_BLOCKS) return
    if (currentItems.some((i) => i.topicId === topicId)) return

    const newItem: ScheduleItem = {
      id: `si-${Date.now()}`,
      topicId,
      source,
      addedAt: Date.now(),
      dayKey,
    }
    set({ dailyPlan: [...currentItems, newItem], planDay: dayKey })
    saveToIdb(extractPersisted(get()))
  },

  removeFromPlan: (id: string) => {
    const state = get()
    set({ dailyPlan: state.dailyPlan.filter((i) => i.id !== id) })
    saveToIdb(extractPersisted(get()))
  },

  clearPlan: () => {
    set({ dailyPlan: [], planDay: getLocalDayKey(new Date()) })
    saveToIdb(extractPersisted(get()))
  },

  autoFillPlan: (today: Date) => {
    const state = get()
    const dayKey = getLocalDayKey(today)
    const currentItems = state.planDay === dayKey ? state.dailyPlan : []
    const t = selectedTopics(state)
    const p = selectedPapers(state)
    const o = selectedOfferings(state)
    const mode = getPlanningMode(today, p)
    const scored = scoreAllTopics(t, p, o, state.subjects, today, mode)
    const newItems = autoFillPlanItems(scored, currentItems, dayKey, Date.now(), today, mode)
    set({ dailyPlan: [...currentItems, ...newItems], planDay: dayKey })
    saveToIdb(extractPersisted(get()))
  },

  getPlanItems: (today: Date): ScheduleItem[] => {
    const state = get()
    return state.planDay === getLocalDayKey(today) ? state.dailyPlan : []
  },

  setStudyMode: (mode: 'gcse' | 'alevel') => {
    set({ studyMode: mode })
    saveToIdb(extractPersisted(get()))
  },

  addCustomSubject: (data) => {
    const state = get()

    // Resolve board
    let boardId = data.boardId as string
    let boardName: string

    if (data.boardId !== 'other') {
      const existingBoard = state.boards.find(b => b.id === data.boardId)
      boardName = existingBoard?.name ?? data.boardId.toUpperCase()
    } else {
      const trimmedName = (data.customBoardName ?? '').trim()
      const matchedBoard = state.boards.find(
        b => b.name.toLowerCase() === trimmedName.toLowerCase()
      )
      if (matchedBoard) {
        boardId = matchedBoard.id
        boardName = matchedBoard.name
      } else {
        boardId = `custom-board-${crypto.randomUUID()}`
        boardName = trimmedName
      }
    }

    const subjectId = `custom-subject-${crypto.randomUUID()}`
    const offeringId = `custom-offering-${crypto.randomUUID()}`

    const newSubject: Subject = {
      id: subjectId,
      name: data.subjectName.trim(),
      color: pickUnusedColor(state.subjects),
    }

    const specLabel = data.spec?.trim() ?? ''
    const newOffering: Offering = {
      id: offeringId,
      subjectId,
      boardId,
      spec: specLabel,
      label: `${boardName} ${specLabel}`.trim(),
      qualificationId: data.qualificationId,
    }

    const newPapers: Paper[] = data.papers.map(p => ({
      id: `custom-paper-${crypto.randomUUID()}`,
      offeringId,
      name: p.name,
      examDate: p.examDate,
      ...(p.examTime ? { examTime: p.examTime } : {}),
    }))

    const firstPaperId = newPapers[0]?.id ?? offeringId
    const newTopics: Topic[] = data.topicNames.map(name => ({
      id: `custom-topic-${crypto.randomUUID()}`,
      paperId: firstPaperId,
      offeringId,
      name,
      confidence: data.confidence,
      performanceScore: 0.5,
      lastReviewed: null,
    }))

    // Build new state arrays
    const boards = boardId.startsWith('custom-board-') && !state.boards.some(b => b.id === boardId)
      ? [...state.boards, { id: boardId, name: boardName }]
      : state.boards
    const subjects = [...state.subjects, newSubject]
    const offerings = [...state.offerings, newOffering]
    const papers = [...state.papers, ...newPapers]
    const topics = [...state.topics, ...newTopics]

    set({ boards, subjects, offerings, papers, topics })
    saveToIdb(extractPersisted(get()))

    return { subjectId, offeringId }
  },

  removeCustomSubject: (subjectId: string) => {
    const state = get()

    // Find offerings for this subject
    const offeringIds = new Set(
      state.offerings.filter(o => o.subjectId === subjectId).map(o => o.id)
    )

    // Find papers for those offerings
    const paperIds = new Set(
      state.papers.filter(p => offeringIds.has(p.offeringId)).map(p => p.id)
    )

    // Find topics for those papers
    const topicIds = new Set(
      state.topics.filter(t => paperIds.has(t.paperId)).map(t => t.id)
    )

    // Check if custom board is orphaned
    const removedOfferings = state.offerings.filter(o => o.subjectId === subjectId)
    const customBoardIds = new Set(
      removedOfferings
        .filter(o => o.boardId.startsWith('custom-board-'))
        .map(o => o.boardId)
    )
    const remainingOfferings = state.offerings.filter(o => !offeringIds.has(o.id))
    const orphanedBoardIds = new Set<string>()
    for (const bid of customBoardIds) {
      if (!remainingOfferings.some(o => o.boardId === bid)) {
        orphanedBoardIds.add(bid)
      }
    }

    set({
      boards: state.boards.filter(b => !orphanedBoardIds.has(b.id)),
      subjects: state.subjects.filter(s => s.id !== subjectId),
      offerings: remainingOfferings,
      papers: state.papers.filter(p => !paperIds.has(p.id)),
      topics: state.topics.filter(t => !topicIds.has(t.id)),
      selectedOfferingIds: state.selectedOfferingIds.filter(id => !offeringIds.has(id)),
      sessions: state.sessions.filter(s => !topicIds.has(s.topicId)),
      notes: state.notes.filter(n => !topicIds.has(n.topicId)),
      dailyPlan: state.dailyPlan.filter(i => !topicIds.has(i.topicId)),
    })
    saveToIdb(extractPersisted(get()))
  },

  resetAll: async () => {
    const freshSeed = deepCloneSeed()
    set({ ...freshSeed, initialized: true })
    await saveToIdb(freshSeed)
  },
}))
