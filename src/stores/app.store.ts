import { create } from 'zustand'
import { openDB, type IDBPDatabase } from 'idb'
import type { Topic, Paper, Subject, Session, ScoredTopic, DayPlan, UserState, Note, ScheduleItem, ScheduleSource } from '../types'
import { scoreAllTopics, buildDayPlan, updatePerformance, adjustConfidence, autoFillPlanItems, TOTAL_BLOCKS } from '../lib/engine'
import { getLocalDayKey } from '../lib/date'
import seedData from '../data/subjects.json'

const DB_NAME = 'gcse-scheduler'
const DB_VERSION = 1
const STORE_NAME = 'state'
const STATE_KEY = 'app'

interface PersistedState {
  topics: Topic[]
  subjects: Subject[]
  papers: Paper[]
  sessions: Session[]
  notes: Note[]
  userState: UserState
  onboarded: boolean
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
  completeOnboarding: (subjectIds: string[], confidences: Map<string, number>) => void
  addNote: (topicId: string, text: string) => void
  getTopicsForSubject: (subjectId: string, today: Date) => ScoredTopic[]
  resetAll: () => Promise<void>
  addToPlan: (topicId: string, source: ScheduleSource, today: Date) => void
  removeFromPlan: (id: string) => void
  clearPlan: () => void
  autoFillPlan: (today: Date) => void
  getPlanItems: (today: Date) => ScheduleItem[]
}

function deepCloneSeed(): PersistedState {
  return {
    subjects: JSON.parse(JSON.stringify(seedData.subjects)) as Subject[],
    papers: JSON.parse(JSON.stringify(seedData.papers)) as Paper[],
    topics: JSON.parse(JSON.stringify(seedData.topics)) as Topic[],
    sessions: [],
    notes: [],
    userState: { energyLevel: 3, stress: 2 },
    onboarded: false,
    dailyPlan: [],
    planDay: '',
  }
}

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }
  return dbPromise
}

async function loadFromIdb(): Promise<PersistedState | null> {
  const db = await getDb()
  const data = await db.get(STORE_NAME, STATE_KEY)
  return data ?? null
}

async function saveToIdb(state: PersistedState): Promise<void> {
  const db = await getDb()
  await db.put(STORE_NAME, state, STATE_KEY)
}

function extractPersisted(state: AppState): PersistedState {
  return {
    topics: state.topics,
    subjects: state.subjects,
    papers: state.papers,
    sessions: state.sessions,
    notes: state.notes,
    userState: state.userState,
    onboarded: state.onboarded,
    dailyPlan: state.dailyPlan,
    planDay: state.planDay,
  }
}

export const useAppStore = create<AppState>()((set, get) => ({
  topics: [],
  subjects: [],
  papers: [],
  sessions: [],
  notes: [],
  userState: { energyLevel: 3, stress: 2 },
  onboarded: false,
  initialized: false,
  dailyPlan: [],
  planDay: '',

  init: async () => {
    const saved = await loadFromIdb()
    if (saved && saved.topics.length > 0) {
      // Ensure plan fields exist (backward compat)
      if (!saved.dailyPlan) saved.dailyPlan = []
      if (!saved.planDay) saved.planDay = ''

      // Plan cleanup — strict equality
      const today = getLocalDayKey(new Date())
      if (saved.planDay && saved.planDay !== today) {
        const hasSessionsOnPlanDay = saved.sessions.some((s) => s.date === saved.planDay)
        if (hasSessionsOnPlanDay) {
          saved.dailyPlan = []
          saved.planDay = today
        } else {
          saved.planDay = today
        }
      }

      set({ ...saved, initialized: true })
      await saveToIdb(saved)
    } else {
      const seed = deepCloneSeed()
      set({ ...seed, initialized: true })
      await saveToIdb(seed)
    }
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
    const scored = scoreAllTopics(state.topics, state.papers, state.subjects, today)
    return buildDayPlan(scored, state.userState, today)
  },

  getAllTopicsScored: (today: Date): ScoredTopic[] => {
    const state = get()
    return scoreAllTopics(state.topics, state.papers, state.subjects, today)
  },

  completeOnboarding: (subjectIds: string[], confidences: Map<string, number>) => {
    const state = get()
    const kept = new Set(subjectIds)
    const subjects = state.subjects.filter((s) => kept.has(s.id))
    const papers = state.papers.filter((p) => kept.has(p.subjectId))
    const topics = state.topics
      .filter((t) => kept.has(t.subjectId))
      .map((t) => ({
        ...t,
        confidence: confidences.get(t.subjectId) ?? t.confidence,
      }))

    set({ subjects, papers, topics, onboarded: true })
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

  getTopicsForSubject: (subjectId: string, today: Date): ScoredTopic[] => {
    const state = get()
    const subjectTopics = state.topics.filter((t) => t.subjectId === subjectId)
    const scored = scoreAllTopics(subjectTopics, state.papers, state.subjects, today)
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
    const scored = scoreAllTopics(state.topics, state.papers, state.subjects, today)
    const newItems = autoFillPlanItems(scored, currentItems, dayKey, Date.now())
    set({ dailyPlan: [...currentItems, ...newItems], planDay: dayKey })
    saveToIdb(extractPersisted(get()))
  },

  getPlanItems: (today: Date): ScheduleItem[] => {
    const state = get()
    return state.planDay === getLocalDayKey(today) ? state.dailyPlan : []
  },

  resetAll: async () => {
    const seed = deepCloneSeed()
    set({ ...seed, initialized: true })
    await saveToIdb(seed)
  },
}))
