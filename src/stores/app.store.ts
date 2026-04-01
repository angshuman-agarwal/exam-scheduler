import { create } from 'zustand'
import type { Topic, Paper, Subject, Board, Offering, Session, ScoredTopic, DayPlan, UserState, Note, ScheduleItem, ScheduleSource, SeedDataV2, AddOfferingData, UpdateOfferingBundleData, OfferingCascadeCounts, PaperAttempt, PaperAttemptSource } from '../types'
import { scoreAllTopics, buildDayPlan, updatePerformance, adjustConfidence, autoFillPlanItems, TOTAL_BLOCKS, getPlanningMode } from '../lib/engine'
import { getLocalDayKey } from '../lib/date'
import { loadFromIdbRaw, saveToIdbRaw } from '../lib/idb'
import { normalizeSubject, normalizeSpec, normalizeTopic } from '../data/templates'
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
  paperAttempts: PaperAttempt[]
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
  logPaperAttempt: (
    paperId: string,
    today: Date,
    durationSeconds: number,
    confidence: number,
    taggedTopicIds: string[],
    source: PaperAttemptSource,
    rawMark?: number,
    totalMarks?: number,
    noteText?: string,
  ) => void
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
    paper: { name: string; examDate: string; examTime?: string }
    topicNames: string[]
    confidence: number
    qualificationId: 'gcse' | 'alevel'
  }) => { subjectId: string; offeringId: string }
  removeCustomSubject: (subjectId: string) => void
  addOfferingToSubject: (subjectId: string, data: AddOfferingData) => { offeringId: string } | null
  updateOfferingBundle: (offeringId: string, data: UpdateOfferingBundleData) => { removedTopicCount: number; removedSessionCount: number; removedNoteCount: number; removedPlanCount: number }
  getOfferingCascadeCounts: (offeringId: string, proposedTopics?: string[]) => OfferingCascadeCounts
  removeOffering: (offeringId: string) => void
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
    paperAttempts: [],
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

  // 2b. Orphan rescue: custom subjects referenced by custom offerings but missing
  const customSubjectIds = new Set(customSubjects.map(s => s.id))
  const referencedSubjectIds = new Set(
    customOfferings
      .filter(o => o.subjectId.startsWith('custom-subject-'))
      .map(o => o.subjectId)
  )
  for (const sid of referencedSubjectIds) {
    if (!customSubjectIds.has(sid) && !fresh.subjects.some(s => s.id === sid)) {
      customSubjects.push({ id: sid, name: 'Recovered subject', color: '#6B7280' })
    }
  }

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
  const validPaperIds = new Set(papers.map((paper) => paper.id))
  const paperAttempts = (saved.paperAttempts ?? []).filter((attempt) => validPaperIds.has(attempt.paperId))
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
    paperAttempts,
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
    paperAttempts: state.paperAttempts,
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

function resolveBoard(
  boards: Board[],
  boardId: string,
  customBoardName?: string,
): { boardId: string; boardName: string; newBoard: Board | null } {
  if (boardId !== 'other') {
    const existing = boards.find(b => b.id === boardId)
    return { boardId, boardName: existing?.name ?? boardId.toUpperCase(), newBoard: null }
  }
  const trimmed = (customBoardName ?? '').trim()
  const matched = boards.find(b => b.name.toLowerCase() === trimmed.toLowerCase())
  if (matched) {
    return { boardId: matched.id, boardName: matched.name, newBoard: null }
  }
  const newId = `custom-board-${crypto.randomUUID()}`
  return { boardId: newId, boardName: trimmed, newBoard: { id: newId, name: trimmed } }
}

function deduplicateSubjects(state: PersistedState): PersistedState {
  // Group subjects by normalized name
  const groups = new Map<string, Subject[]>()
  for (const s of state.subjects) {
    const norm = normalizeSubject(s.name)
    const arr = groups.get(norm) || []
    arr.push(s)
    groups.set(norm, arr)
  }

  const subjectIdRemap = new Map<string, string>() // old → canonical
  const removedSubjectIds = new Set<string>()

  for (const [, group] of groups) {
    if (group.length <= 1) continue

    // Pick canonical: first seeded from original order, else first custom from original order
    // Explicit pick — does not rely on sort stability
    const seeded = group.find(s => !s.id.startsWith('custom-subject-'))
    const canonical = seeded ?? group[0]

    for (const s of group) {
      if (s.id === canonical.id) continue
      subjectIdRemap.set(s.id, canonical.id)
      removedSubjectIds.add(s.id)
    }
  }

  if (removedSubjectIds.size === 0) return state

  // Re-parent offerings
  let offerings = state.offerings.map(o => {
    const newSubjectId = subjectIdRemap.get(o.subjectId)
    return newSubjectId ? { ...o, subjectId: newSubjectId } : o
  })

  // Check for duplicate offerings under canonical (same board + normalizeSpec)
  // Group by subjectId + boardId + normalizedSpec
  const offeringGroups = new Map<string, Offering[]>()
  for (const o of offerings) {
    const key = `${o.subjectId}|${o.boardId}|${normalizeSpec(o.spec)}`
    const arr = offeringGroups.get(key) || []
    arr.push(o)
    offeringGroups.set(key, arr)
  }

  const removedOfferingIds = new Set<string>()
  const offeringIdRemap = new Map<string, string>() // loser offering → winner offering
  const topicIdRemap = new Map<string, string>() // old topic → winner topic
  const disambiguatedOfferingIds = new Set<string>() // offerings that need label disambiguation

  for (const [, oGroup] of offeringGroups) {
    if (oGroup.length <= 1) continue

    // Winner selection rule (data-repair policy):
    // Most recent lastReviewed date across all topics wins.
    // Tie-break: most recent session timestamp. Final tie-break: first in original array order.
    // This is opinionated and irreversible when the merge is safe — it prioritizes the offering
    // the user interacted with most recently, on the assumption that is the "live" one.
    const withSignal = oGroup.map((o, originalIndex) => {
      const oTopics = state.topics.filter(t => t.offeringId === o.id)
      const lastReviewed = oTopics.reduce((max, t) => {
        if (!t.lastReviewed) return max
        return t.lastReviewed > max ? t.lastReviewed : max
      }, '')
      const lastSession = state.sessions
        .filter(s => oTopics.some(t => t.id === s.topicId))
        .reduce((max, s) => s.timestamp && s.timestamp > max ? s.timestamp : max, 0)
      return { offering: o, lastReviewed, lastSession, originalIndex }
    })

    withSignal.sort((a, b) => {
      if (a.lastReviewed !== b.lastReviewed) return b.lastReviewed.localeCompare(a.lastReviewed)
      if (a.lastSession !== b.lastSession) return b.lastSession - a.lastSession
      return a.originalIndex - b.originalIndex // explicit stable tie-break
    })

    const winner = withSignal[0].offering
    for (let i = 1; i < withSignal.length; i++) {
      const loser = withSignal[i].offering
      const winnerTopics = state.topics.filter(t => t.offeringId === winner.id)
      const loserTopics = state.topics.filter(t => t.offeringId === loser.id)

      // Check one-to-one mapping safety using normalizeTopic
      const normWinner = new Map<string, string>() // normalizedName → topicId
      let winnerSafe = true
      for (const t of winnerTopics) {
        const norm = normalizeTopic(t.name)
        if (normWinner.has(norm)) { winnerSafe = false; break }
        normWinner.set(norm, t.id)
      }

      const normLoser = new Map<string, string>()
      let loserSafe = true
      for (const t of loserTopics) {
        const norm = normalizeTopic(t.name)
        if (normLoser.has(norm)) { loserSafe = false; break }
        normLoser.set(norm, t.id)
      }

      let mappingSafe = winnerSafe && loserSafe
      if (mappingSafe) {
        for (const [norm] of normLoser) {
          if (!normWinner.has(norm)) { mappingSafe = false; break }
        }
      }

      if (mappingSafe) {
        // Build remap and mark loser for removal
        for (const [norm, loserId] of normLoser) {
          const winnerId = normWinner.get(norm)!
          topicIdRemap.set(loserId, winnerId)
        }
        removedOfferingIds.add(loser.id)
        offeringIdRemap.set(loser.id, winner.id)
      } else {
        // Unsafe: both offerings survive under canonical, but disambiguate labels
        // so the UI can distinguish them visually
        disambiguatedOfferingIds.add(winner.id)
        disambiguatedOfferingIds.add(loser.id)
      }
    }
  }

  // Disambiguate labels for unsafe duplicate offerings
  if (disambiguatedOfferingIds.size > 0) {
    // Group disambiguated offerings by subjectId + boardId + normalizedSpec
    // Append topic count to label to differentiate
    const disambigGroups = new Map<string, Offering[]>()
    for (const o of offerings) {
      if (!disambiguatedOfferingIds.has(o.id)) continue
      const key = `${o.subjectId}|${o.boardId}|${normalizeSpec(o.spec)}`
      const arr = disambigGroups.get(key) || []
      arr.push(o)
      disambigGroups.set(key, arr)
    }

    offerings = offerings.map(o => {
      if (!disambiguatedOfferingIds.has(o.id)) return o
      const key = `${o.subjectId}|${o.boardId}|${normalizeSpec(o.spec)}`
      const group = disambigGroups.get(key)
      if (!group || group.length <= 1) return o
      const idx = group.indexOf(o) + 1
      const topicCount = state.topics.filter(t => t.offeringId === o.id).length
      return { ...o, label: `${o.label} (#${idx}, ${topicCount} topics)` }
    })
  }

  // Apply removals
  const subjects = state.subjects.filter(s => !removedSubjectIds.has(s.id))
  const finalOfferings = offerings.filter(o => !removedOfferingIds.has(o.id))

  // Remove loser offering papers and topics
  const removedPaperIds = new Set(
    state.papers.filter(p => removedOfferingIds.has(p.offeringId)).map(p => p.id)
  )
  const removedTopicIds = new Set(topicIdRemap.keys())
  const papers = state.papers.filter(p => !removedPaperIds.has(p.id))
  const topics = state.topics.filter(t => !removedTopicIds.has(t.id))

  // Remap sessions/notes/dailyPlan references
  const sessions = state.sessions
    .map(s => {
      const newId = topicIdRemap.get(s.topicId)
      return newId ? { ...s, topicId: newId } : s
    })
    .filter(s => !removedTopicIds.has(s.topicId) || topicIdRemap.has(s.topicId))

  const notes = state.notes
    .map(n => {
      const newId = topicIdRemap.get(n.topicId)
      return newId ? { ...n, topicId: newId } : n
    })
    .filter(n => !removedTopicIds.has(n.topicId) || topicIdRemap.has(n.topicId))

  const validPaperIds = new Set(papers.map((paper) => paper.id))
  const paperAttempts = (state.paperAttempts ?? []).filter((attempt) => validPaperIds.has(attempt.paperId))

  const dailyPlan = state.dailyPlan
    .map(i => {
      const newId = topicIdRemap.get(i.topicId)
      return newId ? { ...i, topicId: newId } : i
    })
    .filter(i => !removedTopicIds.has(i.topicId) || topicIdRemap.has(i.topicId))

  // Remap selectedOfferingIds: loser → winner, then deduplicate
  const selectedOfferingIds = [...new Set(
    state.selectedOfferingIds
      .map(id => offeringIdRemap.get(id) ?? id)
      .filter(id => !removedOfferingIds.has(id))
  )]

  // Update custom arrays
  const customSubjects = subjects.filter(s => s.id.startsWith('custom-subject-'))
  const customOfferings = finalOfferings.filter(o => o.id.startsWith('custom-offering-'))
  const customPapers = papers.filter(p => p.id.startsWith('custom-paper-'))
  const customTopics = topics.filter(t => t.id.startsWith('custom-topic-'))

  return {
    ...state,
    subjects,
    offerings: finalOfferings,
    papers,
    topics,
    sessions,
    paperAttempts,
    notes,
    dailyPlan,
    selectedOfferingIds,
    customSubjects,
    customOfferings,
    customPapers,
    customTopics,
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

function clampTopicConfidence(value: number): number {
  return Math.max(1, Math.min(5, value))
}

export const useAppStore = create<AppState>()((set, get) => ({
  version: 2,
  boards: [],
  subjects: [],
  offerings: [],
  papers: [],
  topics: [],
  sessions: [],
  paperAttempts: [],
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

    // Dedup migration: collapse duplicate subjects
    state = deduplicateSubjects(state)

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
    if (!state.paperAttempts) state.paperAttempts = []

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

  logPaperAttempt: (
    paperId,
    today,
    durationSeconds,
    confidence,
    taggedTopicIds,
    source,
    rawMark,
    totalMarks,
    noteText,
  ) => {
    const state = get()
    const paper = state.papers.find((candidate) => candidate.id === paperId)
    if (!paper) return

    const validTopicIds = new Set(
      state.topics
        .filter((topic) => topic.paperId === paperId)
        .map((topic) => topic.id),
    )
    const sanitizedTaggedTopicIds = [...new Set(taggedTopicIds.filter((topicId) => validTopicIds.has(topicId)))]
    const todayISO = getLocalDayKey(today)

    const updatedTopics = sanitizedTaggedTopicIds.length === 0
      ? state.topics
      : state.topics.map((topic) => {
          if (!sanitizedTaggedTopicIds.includes(topic.id)) return topic
          return {
            ...topic,
            confidence: clampTopicConfidence(topic.confidence - 1),
            lastReviewed: todayISO,
          }
        })

    const paperAttempt: PaperAttempt = {
      id: `paper-attempt-${Date.now()}`,
      paperId,
      date: todayISO,
      timestamp: Date.now(),
      durationSeconds,
      confidence,
      ...(rawMark !== undefined ? { rawMark } : {}),
      ...(totalMarks !== undefined ? { totalMarks } : {}),
      ...(noteText ? { noteText } : {}),
      ...(sanitizedTaggedTopicIds.length > 0 ? { taggedTopicIds: sanitizedTaggedTopicIds } : {}),
      source,
    }

    set({
      topics: updatedTopics,
      paperAttempts: [...state.paperAttempts, paperAttempt],
    })
    saveToIdb(extractPersisted(get()))
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
    const resolved = resolveBoard(state.boards, data.boardId, data.customBoardName)

    const subjectId = `custom-subject-${crypto.randomUUID()}`
    const offeringId = `custom-offering-${crypto.randomUUID()}`
    const paperId = `custom-paper-${crypto.randomUUID()}`

    const newSubject: Subject = {
      id: subjectId,
      name: data.subjectName.trim(),
      color: pickUnusedColor(state.subjects),
    }

    const specLabel = data.spec?.trim() ?? ''
    const newOffering: Offering = {
      id: offeringId,
      subjectId,
      boardId: resolved.boardId,
      spec: specLabel,
      label: `${resolved.boardName} ${specLabel}`.trim(),
      qualificationId: data.qualificationId,
    }

    const newPaper: Paper = {
      id: paperId,
      offeringId,
      name: data.paper.name,
      examDate: data.paper.examDate,
      ...(data.paper.examTime ? { examTime: data.paper.examTime } : {}),
    }

    const newTopics: Topic[] = data.topicNames.map(name => ({
      id: `custom-topic-${crypto.randomUUID()}`,
      paperId,
      offeringId,
      name,
      confidence: data.confidence,
      performanceScore: 0.5,
      lastReviewed: null,
    }))

    const boards = resolved.newBoard && !state.boards.some(b => b.id === resolved.boardId)
      ? [...state.boards, resolved.newBoard]
      : state.boards
    const subjects = [...state.subjects, newSubject]
    const offerings = [...state.offerings, newOffering]
    const papers = [...state.papers, newPaper]
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
      paperAttempts: state.paperAttempts.filter(a => !paperIds.has(a.paperId)),
      notes: state.notes.filter(n => !topicIds.has(n.topicId)),
      dailyPlan: state.dailyPlan.filter(i => !topicIds.has(i.topicId)),
    })
    saveToIdb(extractPersisted(get()))
  },

  addOfferingToSubject: (subjectId, data) => {
    const state = get()
    if (!state.subjects.some(s => s.id === subjectId)) return null

    const resolved = resolveBoard(state.boards, data.boardId, data.customBoardName)

    // Block duplicates: same subject + same board + same normalizeSpec
    const existingOfferings = state.offerings.filter(o => o.subjectId === subjectId)
    const normSpec = normalizeSpec(data.spec)
    if (existingOfferings.some(o => o.boardId === resolved.boardId && normalizeSpec(o.spec) === normSpec)) {
      return null
    }

    const offeringId = `custom-offering-${crypto.randomUUID()}`
    const paperId = `custom-paper-${crypto.randomUUID()}`
    const specLabel = data.spec?.trim() ?? ''

    const newOffering: Offering = {
      id: offeringId,
      subjectId,
      boardId: resolved.boardId,
      spec: specLabel,
      label: `${resolved.boardName} ${specLabel}`.trim(),
      qualificationId: data.qualificationId,
    }

    const newPaper: Paper = {
      id: paperId,
      offeringId,
      name: data.paper.name,
      examDate: data.paper.examDate,
      ...(data.paper.examTime ? { examTime: data.paper.examTime } : {}),
    }

    const newTopics: Topic[] = data.topicNames.map(name => ({
      id: `custom-topic-${crypto.randomUUID()}`,
      paperId,
      offeringId,
      name,
      confidence: 3, // bootstrap
      performanceScore: 0.5,
      lastReviewed: null,
    }))

    const boards = resolved.newBoard && !state.boards.some(b => b.id === resolved.boardId)
      ? [...state.boards, resolved.newBoard]
      : state.boards

    set({
      boards,
      offerings: [...state.offerings, newOffering],
      papers: [...state.papers, newPaper],
      topics: [...state.topics, ...newTopics],
    })
    saveToIdb(extractPersisted(get()))
    return { offeringId }
  },

  updateOfferingBundle: (offeringId, data) => {
    const state = get()
    if (!offeringId.startsWith('custom-offering-')) {
      return { removedTopicCount: 0, removedSessionCount: 0, removedNoteCount: 0, removedPlanCount: 0 }
    }

    // Find existing paper and topics
    const existingPaper = state.papers.find(p => p.offeringId === offeringId)
    const existingTopics = state.topics.filter(t => t.offeringId === offeringId)

    // Update paper in place (keep ID)
    const paperId = existingPaper?.id ?? `custom-paper-${crypto.randomUUID()}`
    const updatedPaper: Paper = {
      id: paperId,
      offeringId,
      name: data.paper.name,
      examDate: data.paper.examDate,
      ...(data.paper.examTime ? { examTime: data.paper.examTime } : {}),
    }

    // Diff topics: match by normalized name to preserve IDs and linked data
    const existingByNorm = new Map<string, Topic>()
    for (const t of existingTopics) {
      existingByNorm.set(normalizeTopic(t.name), t)
    }

    const keptTopicIds = new Set<string>()
    const finalTopics: Topic[] = []
    for (const name of data.topics) {
      const norm = normalizeTopic(name)
      const existing = existingByNorm.get(norm)
      if (existing) {
        keptTopicIds.add(existing.id)
        // Preserve existing topic, update display name if casing changed
        finalTopics.push(existing.name !== name ? { ...existing, name } : existing)
      } else {
        finalTopics.push({
          id: `custom-topic-${crypto.randomUUID()}`,
          paperId,
          offeringId,
          name,
          confidence: 3,
          performanceScore: 0.5,
          lastReviewed: null,
        })
      }
    }

    const removedTopicIds = new Set(
      existingTopics.filter(t => !keptTopicIds.has(t.id)).map(t => t.id)
    )

    // Count cascaded deletions (only for removed topics)
    const removedSessionCount = state.sessions.filter(s => removedTopicIds.has(s.topicId)).length
    const removedNoteCount = state.notes.filter(n => removedTopicIds.has(n.topicId)).length
    const removedPlanCount = state.dailyPlan.filter(i => removedTopicIds.has(i.topicId)).length

    const papers = existingPaper
      ? state.papers.map(p => p.id === paperId ? updatedPaper : p)
      : [...state.papers, updatedPaper]
    const topics = [...state.topics.filter(t => t.offeringId !== offeringId), ...finalTopics]
    const sessions = state.sessions.filter(s => !removedTopicIds.has(s.topicId))
    const notes = state.notes.filter(n => !removedTopicIds.has(n.topicId))
    const dailyPlan = state.dailyPlan.filter(i => !removedTopicIds.has(i.topicId))
    const remainingPaperIds = new Set(papers.map((paper) => paper.id))
    const paperAttempts = state.paperAttempts.filter((attempt) => remainingPaperIds.has(attempt.paperId))

    set({ papers, topics, sessions, paperAttempts, notes, dailyPlan })
    saveToIdb(extractPersisted(get()))

    return {
      removedTopicCount: removedTopicIds.size,
      removedSessionCount,
      removedNoteCount,
      removedPlanCount,
    }
  },

  getOfferingCascadeCounts: (offeringId, proposedTopics) => {
    const state = get()
    const existingTopics = state.topics.filter(t => t.offeringId === offeringId)

    // If proposed topics provided, only count removals (topics not in proposed list)
    let removedTopics = existingTopics
    if (proposedTopics) {
      const proposedNorms = new Set(proposedTopics.map(normalizeTopic))
      removedTopics = existingTopics.filter(t => !proposedNorms.has(normalizeTopic(t.name)))
    }

    const topicIds = new Set(removedTopics.map(t => t.id))
    const paperIds = new Set(state.papers.filter(p => p.offeringId === offeringId).map(p => p.id))
    return {
      topicCount: removedTopics.length,
      sessionCount: state.sessions.filter(s => topicIds.has(s.topicId)).length,
      noteCount: state.notes.filter(n => topicIds.has(n.topicId)).length,
      planCount: state.dailyPlan.filter(i => topicIds.has(i.topicId)).length,
      paperAttemptCount: state.paperAttempts.filter(a => paperIds.has(a.paperId)).length,
    }
  },

  removeOffering: (offeringId) => {
    if (!offeringId.startsWith('custom-offering-')) return
    const state = get()

    const offering = state.offerings.find(o => o.id === offeringId)
    if (!offering) return

    const paperIds = new Set(state.papers.filter(p => p.offeringId === offeringId).map(p => p.id))
    const topicIds = new Set(state.topics.filter(t => t.offeringId === offeringId).map(t => t.id))

    // Check if custom board is orphaned
    const remainingOfferings = state.offerings.filter(o => o.id !== offeringId)
    const orphanedBoardIds = new Set<string>()
    if (offering.boardId.startsWith('custom-board-')) {
      if (!remainingOfferings.some(o => o.boardId === offering.boardId)) {
        orphanedBoardIds.add(offering.boardId)
      }
    }

    // Check if subject should be removed (custom with zero remaining offerings)
    const subjectOfferingsLeft = remainingOfferings.filter(o => o.subjectId === offering.subjectId)
    const removeSubject = offering.subjectId.startsWith('custom-subject-') && subjectOfferingsLeft.length === 0

    set({
      boards: state.boards.filter(b => !orphanedBoardIds.has(b.id)),
      subjects: removeSubject ? state.subjects.filter(s => s.id !== offering.subjectId) : state.subjects,
      offerings: remainingOfferings,
      papers: state.papers.filter(p => !paperIds.has(p.id)),
      topics: state.topics.filter(t => !topicIds.has(t.id)),
      selectedOfferingIds: state.selectedOfferingIds.filter(id => id !== offeringId),
      sessions: state.sessions.filter(s => !topicIds.has(s.topicId)),
      paperAttempts: state.paperAttempts.filter(a => !paperIds.has(a.paperId)),
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
