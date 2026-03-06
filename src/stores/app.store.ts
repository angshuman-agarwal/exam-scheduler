import { create } from 'zustand'
import type { Topic, Paper, Subject, Board, Offering, Session, ScoredTopic, DayPlan, UserState, Note, ScheduleItem, ScheduleSource, SeedDataV2 } from '../types'
import { scoreAllTopics, buildDayPlan, updatePerformance, adjustConfidence, autoFillPlanItems, TOTAL_BLOCKS } from '../lib/engine'
import { getLocalDayKey } from '../lib/date'
import { loadFromIdbRaw, saveToIdbRaw } from '../lib/idb'
import seedData from '../data/subjects.json'

const STATE_KEY = 'app'

const seed = seedData as SeedDataV2

// Bump this whenever seed data changes (new fields, new papers, etc.)
// Stale IDB with a lower revision will be reseeded on next load.
const SEED_REVISION = 2

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
  addNote: (topicId: string, text: string) => void
  getTopicsForOffering: (offeringId: string, today: Date) => ScoredTopic[]
  resetAll: () => Promise<void>
  addToPlan: (topicId: string, source: ScheduleSource, today: Date) => void
  removeFromPlan: (id: string) => void
  clearPlan: () => void
  autoFillPlan: (today: Date) => void
  getPlanItems: (today: Date) => ScheduleItem[]
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
  // Build map of old topics for preserving user-owned fields
  const oldTopicMap = new Map(saved.topics.map((t) => [t.id, t]))

  // Merge topics: seed-owned fields from fresh, user-owned fields from saved
  const mergedTopics = fresh.topics.map((t) => {
    const old = oldTopicMap.get(t.id)
    if (!old) return t
    return {
      ...t,
      confidence: old.confidence,
      performanceScore: old.performanceScore,
      lastReviewed: old.lastReviewed,
    }
  })

  const validTopicIds = new Set(mergedTopics.map((t) => t.id))
  const validOfferingIds = new Set(fresh.offerings.map((o) => o.id))

  // Filter user data to only valid IDs
  const selectedOfferingIds = saved.selectedOfferingIds.filter((id) => validOfferingIds.has(id))
  const onboarded = selectedOfferingIds.length > 0 ? saved.onboarded : false
  const sessions = saved.sessions.filter((s) => validTopicIds.has(s.topicId))
  const notes = saved.notes.filter((n) => validTopicIds.has(n.topicId))
  const dailyPlan = saved.dailyPlan.filter((i) => validTopicIds.has(i.topicId))

  return {
    version: 2,
    seedRevision: SEED_REVISION,
    boards: fresh.boards,
    subjects: fresh.subjects,
    offerings: fresh.offerings,
    papers: fresh.papers,
    topics: mergedTopics,
    sessions,
    notes,
    userState: saved.userState,
    onboarded,
    selectedOfferingIds,
    dailyPlan,
    planDay: saved.planDay,
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

  init: async () => {
    const loaded = await loadFromIdb()

    let state: PersistedState
    if (!loaded) {
      // No saved state or invalid schema — fresh seed
      state = deepCloneSeed()
    } else if (loaded.needsMerge) {
      // Valid schema but stale seed revision — merge user data into fresh catalog
      state = mergeWithFreshSeed(loaded.state, deepCloneSeed())
    } else {
      // Current seed revision — use as-is
      state = loaded.state
    }

    // Backfill optional fields from older persisted states
    if (!state.dailyPlan) state.dailyPlan = []
    if (!state.planDay) state.planDay = ''
    if (!state.selectedOfferingIds) state.selectedOfferingIds = []

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
    const scored = scoreAllTopics(t, p, o, state.subjects, today)
    return buildDayPlan(scored, state.userState, today)
  },

  getAllTopicsScored: (today: Date): ScoredTopic[] => {
    const state = get()
    const t = selectedTopics(state)
    const p = selectedPapers(state)
    const o = selectedOfferings(state)
    return scoreAllTopics(t, p, o, state.subjects, today)
  },

  completeOnboarding: (offeringIds: string[], confidences: Map<string, number>) => {
    const state = get()
    const kept = new Set(offeringIds)

    // Update confidence on topics belonging to selected offerings
    const topics = state.topics.map((t) => {
      if (!kept.has(t.offeringId)) return t
      const conf = confidences.get(t.offeringId)
      return conf !== undefined ? { ...t, confidence: conf } : t
    })

    set({ topics, selectedOfferingIds: offeringIds, onboarded: true })
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
    const scored = scoreAllTopics(offeringTopics, offeringPapers, offering, state.subjects, today)
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
    const scored = scoreAllTopics(t, p, o, state.subjects, today)
    const newItems = autoFillPlanItems(scored, currentItems, dayKey, Date.now())
    set({ dailyPlan: [...currentItems, ...newItems], planDay: dayKey })
    saveToIdb(extractPersisted(get()))
  },

  getPlanItems: (today: Date): ScheduleItem[] => {
    const state = get()
    return state.planDay === getLocalDayKey(today) ? state.dailyPlan : []
  },

  resetAll: async () => {
    const freshSeed = deepCloneSeed()
    set({ ...freshSeed, initialized: true })
    await saveToIdb(freshSeed)
  },
}))
