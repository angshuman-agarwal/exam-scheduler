declare const __E2E_BRIDGE__: boolean

import { create } from 'zustand'
import { useShallow } from 'zustand/shallow'
import type { Topic, Paper, Subject, Board, Offering, Session, ScoredTopic, DayPlan, UserState, Note, ScheduleItem, ScheduleSource, SeedDataV2, AddOfferingData, UpdateOfferingBundleData, OfferingCascadeCounts } from '../types'
import { scoreAllTopics, buildDayPlan, updatePerformance, adjustConfidence, autoFillPlanItems, TOTAL_BLOCKS, getPlanningMode } from '../lib/engine'
import { getLocalDayKey } from '../lib/date'
import { loadFromIdbRaw, saveToIdbRaw } from '../lib/idb'
import { normalizeSubject, normalizeSpec, normalizeTopic } from '../data/templates'
import seedData from '../data/subjects.json'

const STATE_KEY = 'app'

const seed = seedData as SeedDataV2

import { SEED_REVISION } from '../lib/constants'

// ── Tier-split migration mappings ──

/** Maps old mixed-tier offering IDs → [Foundation, Higher] replacement IDs */
export const TIER_SPLIT_MAP: Record<string, [string, string]> = {
  'maths-aqa':    ['maths-aqa-f',  'maths-aqa-h'],
  'maths-edexcel':['maths-edexcel-f','maths-edexcel-h'],
  'bio-aqa':      ['bio-aqa-f',    'bio-aqa-h'],
  'chem-aqa':     ['chem-aqa-f',   'chem-aqa-h'],
  'phys-aqa':     ['phys-aqa-f',   'phys-aqa-h'],
}

/** Maps old paper IDs → [Foundation paper, Higher paper] */
export const PAPER_SPLIT_MAP: Record<string, [string, string]> = {
  'maths-aqa-p1': ['maths-aqa-f-paper1','maths-aqa-h-paper1'],
  'maths-aqa-p2': ['maths-aqa-f-paper2','maths-aqa-h-paper2'],
  'maths-aqa-p3': ['maths-aqa-f-paper3','maths-aqa-h-paper3'],
  'maths-p1':     ['maths-edexcel-f-paper1','maths-edexcel-h-paper1'],
  'maths-p2':     ['maths-edexcel-f-paper2','maths-edexcel-h-paper2'],
  'maths-p3':     ['maths-edexcel-f-paper3','maths-edexcel-h-paper3'],
  'bio-p1':       ['bio-aqa-f-paper1','bio-aqa-h-paper1'],
  'bio-p2':       ['bio-aqa-f-paper2','bio-aqa-h-paper2'],
  'chem-p1':      ['chem-aqa-f-paper1','chem-aqa-h-paper1'],
  'chem-p2':      ['chem-aqa-f-paper2','chem-aqa-h-paper2'],
  'phys-p1':      ['phys-aqa-f-paper1','phys-aqa-h-paper1'],
  'phys-p2':      ['phys-aqa-f-paper2','phys-aqa-h-paper2'],
}

// ── Compat clone ID helpers ──

const MIGRATED_DELIM = '-migrated-'

export function makeCompatCloneId(originId: string, targetTopicId: string): string {
  return `${originId}${MIGRATED_DELIM}${targetTopicId}`
}

export function getMigrationOriginId(id: string): string | null {
  const idx = id.indexOf(MIGRATED_DELIM)
  return idx >= 0 ? id.slice(0, idx) : null
}

// ── Tier-family membership helpers ──

/** Resolves canonical boardId from any offering ID (new tier, legacy, or TIER_SPLIT_MAP key) */
export function getTierFamilyBoardId(seedData: SeedDataV2, subjectId: string, offeringIdOrLegacyId: string): string {
  // Check seed offerings first
  const seedOff = seedData.offerings.find(o => o.id === offeringIdOrLegacyId)
  if (seedOff && seedOff.subjectId === subjectId) return seedOff.boardId
  // Check TIER_SPLIT_MAP keys
  const split = TIER_SPLIT_MAP[offeringIdOrLegacyId]
  if (split) {
    const fOff = seedData.offerings.find(o => o.id === split[0])
    if (fOff) return fOff.boardId
  }
  throw new Error(`Cannot resolve tier family board for ${subjectId}/${offeringIdOrLegacyId}`)
}

/** Returns ALL mutually exclusive tiered offering IDs for a subject+board pair (legacy + F + H) */
export function getTierFamilyOfferingIds(seedData: SeedDataV2, subjectId: string, canonicalBoardId: string): string[] {
  const result: string[] = []
  for (const [legacyId, [fId, hId]] of Object.entries(TIER_SPLIT_MAP)) {
    const fOff = seedData.offerings.find(o => o.id === fId)
    if (!fOff || fOff.subjectId !== subjectId || fOff.boardId !== canonicalBoardId) continue
    result.push(legacyId, fId, hId)
  }
  return result
}

// Pre-computed set of all tier-split offering IDs (legacy + F + H)
const ALL_TIER_OFFERING_IDS = new Set<string>()
for (const [legacyId, [fId, hId]] of Object.entries(TIER_SPLIT_MAP)) {
  ALL_TIER_OFFERING_IDS.add(legacyId)
  ALL_TIER_OFFERING_IDS.add(fId)
  ALL_TIER_OFFERING_IDS.add(hId)
}

/**
 * Normalize a caller-provided offering ID array at the API boundary.
 * - Strips legacy offering IDs (they should never be persisted post-migration)
 * - Ensures exactly one offering per tier-split subject (last wins)
 * - Passes through non-tier offerings unchanged
 */
function normalizeTierSelections(offeringIds: string[], offerings: Offering[]): string[] {
  const nonTier: string[] = []
  const tierBySubject = new Map<string, string>()
  for (const oid of offeringIds) {
    if (!ALL_TIER_OFFERING_IDS.has(oid)) {
      nonTier.push(oid)
      continue
    }
    // Skip legacy IDs — they should not be persisted
    if (TIER_SPLIT_MAP[oid]) continue
    const off = offerings.find(o => o.id === oid)
    if (off) tierBySubject.set(off.subjectId, oid)
  }
  return [...nonTier, ...tierBySubject.values()]
}

/**
 * Merge caller-provided offering IDs with the store's post-action state.
 * For tier-split subjects: store is authoritative (actions already ran).
 * For non-tier subjects: caller is authoritative.
 * For tier-split subjects where no action ran (new selection, not migration): caller is used.
 */
function mergeTierAuthoritative(callerIds: string[], storeIds: string[], offerings: Offering[]): string[] {
  // Determine which tier-split subjects the caller wants (any tier offering present)
  const callerWantsTierSubject = new Set<string>()
  for (const oid of callerIds) {
    if (!ALL_TIER_OFFERING_IDS.has(oid)) continue
    if (TIER_SPLIT_MAP[oid]) continue // legacy — still counts as "wants this subject"
    const off = offerings.find(o => o.id === oid)
    if (off) callerWantsTierSubject.add(off.subjectId)
  }
  // Legacy IDs also signal intent for that subject
  for (const oid of callerIds) {
    if (!TIER_SPLIT_MAP[oid]) continue
    const [fId] = TIER_SPLIT_MAP[oid]
    const fOff = offerings.find(o => o.id === fId)
    if (fOff) callerWantsTierSubject.add(fOff.subjectId)
  }

  // Collect tier selections set by actions in store, only for subjects caller wants
  const tierBySubject = new Map<string, string>()
  for (const oid of storeIds) {
    if (!ALL_TIER_OFFERING_IDS.has(oid)) continue
    if (TIER_SPLIT_MAP[oid]) continue
    const off = offerings.find(o => o.id === oid)
    if (off && callerWantsTierSubject.has(off.subjectId)) {
      tierBySubject.set(off.subjectId, oid)
    }
  }

  // Non-tier from caller
  const nonTier: string[] = []
  for (const oid of callerIds) {
    if (!ALL_TIER_OFFERING_IDS.has(oid)) {
      nonTier.push(oid)
      continue
    }
    if (TIER_SPLIT_MAP[oid]) continue
    const off = offerings.find(o => o.id === oid)
    if (!off) continue
    // Only add from caller if store didn't already set one for this subject
    if (!tierBySubject.has(off.subjectId)) {
      tierBySubject.set(off.subjectId, oid)
    }
  }

  return [...nonTier, ...tierBySubject.values()]
}

/** Derive subject ID from a TIER_SPLIT_MAP key */
function getSubjectIdForLegacyOffering(legacyOfferingId: string): string | null {
  // Legacy IDs follow pattern: subjectId-boardId (e.g. maths-aqa, bio-aqa)
  // But the actual subject IDs may differ (maths-edexcel → subjectId=maths)
  // Use the seed's new offerings to back-derive
  const pair = TIER_SPLIT_MAP[legacyOfferingId]
  if (!pair) return null
  const fOff = seed.offerings.find(o => o.id === pair[0])
  return fOff?.subjectId ?? null
}

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

  // ── Non-persisted tier-split compat state ──
  pendingTierConfirmations: Set<string>        // subject IDs needing tier pick
  pendingTierBoardIds: Map<string, string>     // subjectId → canonical boardId
  compatSelectedOfferingIds: Map<string, string[]>  // subjectId → [new F, new H]
  tierPairTopicMap: Map<string, { pairTopicId: string; legacyGroupKey: string }>
  compatTopicDedupeMap: Map<string, string>    // newTopicId → legacyGroupKey (pending-only)

  // ── Actions ──
  init: () => Promise<void>
  logSession: (topicId: string, rawScore: number, today: Date, durationSeconds?: number, source?: ScheduleSource) => void
  setEnergy: (level: number) => void
  setStress: (level: number) => void
  getDayPlan: (today: Date) => DayPlan
  getAllTopicsScored: (today: Date) => ScoredTopic[]
  completeOnboarding: (offeringIds: string[], confidences: Map<string, number>) => void
  updateSelectedOfferings: (offeringIds: string[], confidences: Map<string, number>) => void
  addNote: (topicId: string, text: string) => void
  removeNoteById: (noteId: string) => void
  updateNoteById: (noteId: string, text: string) => void
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
  confirmTierSelection: (subjectId: string, offeringId: string) => void
  switchTierSelection: (subjectId: string, fromOfferingId: string, toOfferingId: string) => void
  dismissPendingSubject: (subjectId: string) => void
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

  // ── Step A: Tier-split migration — copy user fields from old topics to new tiered topics ──
  // Index old topics under removed offerings by normalized name + old offering + old paper
  const oldTopicsByKey = new Map<string, Topic>()
  for (const t of saved.topics) {
    if (TIER_SPLIT_MAP[t.offeringId]) {
      const key = `${normalizeTopic(t.name)}|${t.offeringId}|${t.paperId}`
      oldTopicsByKey.set(key, t)
    }
  }

  // Step B: Copy user-owned fields onto new seed topics
  const topicIdRemap = new Map<string, string[]>() // oldTopicId → [newTopicIds]
  for (const newTopic of mergedSeedTopics) {
    // Check if this new topic's offering is a replacement for an old one
    for (const [oldOfferingId, [fId, hId]] of Object.entries(TIER_SPLIT_MAP)) {
      if (newTopic.offeringId !== fId && newTopic.offeringId !== hId) continue

      // Find the matching old paper via PAPER_SPLIT_MAP
      for (const [oldPaperId, [fPaperId, hPaperId]] of Object.entries(PAPER_SPLIT_MAP)) {
        const matchPaperId = newTopic.offeringId === fId ? fPaperId : hPaperId
        if (newTopic.paperId !== matchPaperId) continue

        const key = `${normalizeTopic(newTopic.name)}|${oldOfferingId}|${oldPaperId}`
        const oldTopic = oldTopicsByKey.get(key)
        if (oldTopic) {
          newTopic.confidence = oldTopic.confidence
          newTopic.performanceScore = oldTopic.performanceScore
          newTopic.lastReviewed = oldTopic.lastReviewed
          // Build remap
          const existing = topicIdRemap.get(oldTopic.id) ?? []
          existing.push(newTopic.id)
          topicIdRemap.set(oldTopic.id, existing)
        }
      }
    }
  }

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

  // ── Step E: Clone sessions/notes/planItems for remapped topics BEFORE filtering ──
  let sessions = [...saved.sessions]
  let notes = [...saved.notes]
  let dailyPlan = [...saved.dailyPlan]

  for (const [oldTopicId, newTopicIds] of topicIdRemap) {
    // Clone sessions
    const oldSessions = saved.sessions.filter(s => s.topicId === oldTopicId)
    for (const s of oldSessions) {
      for (const targetTopicId of newTopicIds) {
        sessions.push({
          ...s,
          id: makeCompatCloneId(s.id, targetTopicId),
          topicId: targetTopicId,
        })
      }
    }

    // Clone notes
    const oldNotes = saved.notes.filter(n => n.topicId === oldTopicId)
    for (const n of oldNotes) {
      for (const targetTopicId of newTopicIds) {
        notes.push({
          ...n,
          id: makeCompatCloneId(n.id, targetTopicId),
          topicId: targetTopicId,
        })
      }
    }

    // Clone plan items
    const oldPlanItems = saved.dailyPlan.filter(i => i.topicId === oldTopicId)
    for (const item of oldPlanItems) {
      for (const targetTopicId of newTopicIds) {
        dailyPlan.push({
          ...item,
          id: makeCompatCloneId(item.id, targetTopicId),
          topicId: targetTopicId,
        })
      }
    }
  }

  // 4. Build valid ID sets from merged arrays (seed + custom)
  const validOfferingIds = new Set(offerings.map((o) => o.id))
  const validTopicIds = new Set(topics.map((t) => t.id))

  // 5. Filter — remove old dangling records, keep cloned ones
  sessions = sessions.filter((s) => validTopicIds.has(s.topicId))
  notes = notes.filter((n) => validTopicIds.has(n.topicId))
  dailyPlan = dailyPlan.filter((i) => validTopicIds.has(i.topicId))

  // Filter selected offerings — but preserve tier-split subjects by mapping to new IDs
  const selectedOfferingIds: string[] = []
  for (const id of saved.selectedOfferingIds) {
    if (validOfferingIds.has(id)) {
      selectedOfferingIds.push(id)
    } else if (TIER_SPLIT_MAP[id]) {
      // Legacy offering: add both F and H as compat candidates
      const [fId, hId] = TIER_SPLIT_MAP[id]
      if (validOfferingIds.has(fId) && !selectedOfferingIds.includes(fId)) selectedOfferingIds.push(fId)
      if (validOfferingIds.has(hId) && !selectedOfferingIds.includes(hId)) selectedOfferingIds.push(hId)
    }
  }
  const onboarded = selectedOfferingIds.length > 0 ? saved.onboarded : false

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
    const key = `${o.subjectId}|${o.boardId}|${normalizeSpec(o.spec)}|${o.label.toLowerCase().trim()}`
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
      const key = `${o.subjectId}|${o.boardId}|${normalizeSpec(o.spec)}|${o.label.toLowerCase().trim()}`
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
    notes,
    dailyPlan,
    selectedOfferingIds,
    customSubjects,
    customOfferings,
    customPapers,
    customTopics,
  }
}

// ── Effective offering ID selector (bridges persisted + compat) ──

function effectiveSelectedOfferingIds(state: AppState): string[] {
  const persisted = new Set(state.selectedOfferingIds)
  // Derive which subjects already have an explicit selection
  const explicitSubjectIds = new Set<string>()
  for (const oid of persisted) {
    const off = state.offerings.find(o => o.id === oid)
    if (off) explicitSubjectIds.add(off.subjectId)
  }
  // Expand with compat offerings for pending subjects NOT in explicitSubjectIds
  const expanded = [...persisted]
  for (const [subjectId, offeringIds] of state.compatSelectedOfferingIds) {
    if (!explicitSubjectIds.has(subjectId)) {
      for (const oid of offeringIds) if (!persisted.has(oid)) expanded.push(oid)
    }
  }
  return expanded
}

/** Exported selector for components — useShallow prevents infinite re-render */
export function useEffectiveSelectedOfferingIds(): string[] {
  return useAppStore(useShallow(state => effectiveSelectedOfferingIds(state)))
}

/**
 * Logical read layer: collapses pending twin offerings to one canonical
 * branch per pending subject. Read-only consumers (planner, progress, today)
 * use this so they see one study path per subject instead of doubled F+H twins.
 * The first compat offering (Foundation) is the canonical branch for reads.
 */
function logicalSelectedOfferingIds(state: AppState): string[] {
  const effective = effectiveSelectedOfferingIds(state)
  if (state.pendingTierConfirmations.size === 0) return effective
  // For pending subjects, keep only the first compat offering (canonical read branch)
  const skipIds = new Set<string>()
  for (const [, offeringIds] of state.compatSelectedOfferingIds) {
    // Skip all but the first (Foundation is canonical for reads)
    for (let i = 1; i < offeringIds.length; i++) {
      skipIds.add(offeringIds[i])
    }
  }
  return effective.filter(id => !skipIds.has(id))
}

/** Exported selector for read-only components (Today, Progress, App shell) */
export function useLogicalSelectedOfferingIds(): string[] {
  return useAppStore(useShallow(state => logicalSelectedOfferingIds(state)))
}

// Filter topics/papers to only selected offerings (using logical IDs for reads)
function selectedTopics(state: AppState): Topic[] {
  const ids = new Set(logicalSelectedOfferingIds(state))
  return state.topics.filter((t) => ids.has(t.offeringId))
}

function selectedPapers(state: AppState): Paper[] {
  const ids = new Set(logicalSelectedOfferingIds(state))
  return state.papers.filter((p) => ids.has(p.offeringId))
}

function selectedOfferings(state: AppState): Offering[] {
  const ids = new Set(logicalSelectedOfferingIds(state))
  return state.offerings.filter((o) => ids.has(o.id))
}

// ── Compat write/read helpers ──

function resolveCompatWriteTargets(state: AppState, topicId: string): string[] {
  if (state.pendingTierConfirmations.size === 0) return [topicId]
  const topic = state.topics.find(t => t.id === topicId)
  if (!topic) return [topicId]
  const offering = state.offerings.find(o => o.id === topic.offeringId)
  if (!offering || !state.pendingTierConfirmations.has(offering.subjectId)) return [topicId]
  const pair = state.tierPairTopicMap.get(topicId)
  if (!pair) return [topicId]
  return [topicId, pair.pairTopicId]
}

export function resolveCompatRecordSiblings(_state: AppState, recordId: string, records: { id: string }[]): string[] {
  const originId = getMigrationOriginId(recordId) ?? recordId
  return records
    .filter(r => {
      const ro = getMigrationOriginId(r.id) ?? r.id
      return ro === originId
    })
    .map(r => r.id)
}

// ── Build tier pair topic map from seed ──

function buildTierPairTopicMap(seedData: SeedDataV2): Map<string, { pairTopicId: string; legacyGroupKey: string }> {
  const map = new Map<string, { pairTopicId: string; legacyGroupKey: string }>()

  for (const [legacyOfferingId, [fOfferingId, hOfferingId]] of Object.entries(TIER_SPLIT_MAP)) {
    // Build paper mapping: fPaperId ↔ hPaperId
    const paperPairs: [string, string][] = []
    for (const [, [fPid, hPid]] of Object.entries(PAPER_SPLIT_MAP)) {
      if (seedData.papers.some(p => p.id === fPid && p.offeringId === fOfferingId) &&
          seedData.papers.some(p => p.id === hPid && p.offeringId === hOfferingId)) {
        paperPairs.push([fPid, hPid])
      }
    }

    // Match F and H topics by normalized name within each paper pair
    for (const [fPaperId, hPaperId] of paperPairs) {
      const fTopics = seedData.topics.filter(t => t.offeringId === fOfferingId && t.paperId === fPaperId)
      const hTopics = seedData.topics.filter(t => t.offeringId === hOfferingId && t.paperId === hPaperId)
      const hByNorm = new Map(hTopics.map(t => [normalizeTopic(t.name), t]))

      for (const ft of fTopics) {
        const norm = normalizeTopic(ft.name)
        const ht = hByNorm.get(norm)
        if (ht) {
          const legacyGroupKey = `${legacyOfferingId}|${norm}`
          map.set(ft.id, { pairTopicId: ht.id, legacyGroupKey })
          map.set(ht.id, { pairTopicId: ft.id, legacyGroupKey })
        }
      }
    }
  }

  return map
}

// ── Build compat state from persisted + seed ──

interface CompatState {
  pendingTierConfirmations: Set<string>
  pendingTierBoardIds: Map<string, string>
  compatSelectedOfferingIds: Map<string, string[]>
  compatTopicDedupeMap: Map<string, string>
}

interface CompatStateResult extends CompatState {
  cleanedSelectedOfferingIds: string[]
}

function computeCompatState(state: PersistedState, seedData: SeedDataV2): CompatStateResult {
  const pending = new Set<string>()
  const boardIds = new Map<string, string>()
  const compatOfferings = new Map<string, string[]>()
  const dedupeMap = new Map<string, string>()
  let selectedOfferingIds = [...state.selectedOfferingIds]

  // Group tier-split entries by subject to handle board-family disambiguation
  const subjectFamilies = new Map<string, Array<{ legacyId: string; fId: string; hId: string; boardId: string }>>()

  for (const [legacyId, [fId, hId]] of Object.entries(TIER_SPLIT_MAP)) {
    const subjectId = getSubjectIdForLegacyOffering(legacyId)
    if (!subjectId) continue

    const hasLegacy = selectedOfferingIds.includes(legacyId)
    const hasF = selectedOfferingIds.includes(fId)
    const hasH = selectedOfferingIds.includes(hId)
    if (!hasLegacy && !hasF && !hasH) continue

    let boardId: string
    try {
      boardId = getTierFamilyBoardId(seedData, subjectId, fId)
    } catch { continue }

    const arr = subjectFamilies.get(subjectId) ?? []
    arr.push({ legacyId, fId, hId, boardId })
    subjectFamilies.set(subjectId, arr)
  }

  // For each subject with tier-split offerings, disambiguate board family if multiple
  for (const [subjectId, families] of subjectFamilies) {
    let chosenFamily: typeof families[0]

    if (families.length === 1) {
      chosenFamily = families[0]
    } else {
      // Multiple board families for same subject — disambiguate
      // (1) prefer family containing a legacy offering ID
      const legacyFamilies = families.filter(f => selectedOfferingIds.includes(f.legacyId))
      if (legacyFamilies.length === 1) {
        chosenFamily = legacyFamilies[0]
      } else if (legacyFamilies.length > 1) {
        // (2) multiple legacy — prefer earliest in persisted array order
        chosenFamily = legacyFamilies.sort((a, b) =>
          selectedOfferingIds.indexOf(a.legacyId) - selectedOfferingIds.indexOf(b.legacyId)
        )[0]
      } else {
        // No legacy — prefer earliest non-legacy in array order
        const indexOf = (f: typeof families[0]) => Math.min(
          selectedOfferingIds.indexOf(f.fId) >= 0 ? selectedOfferingIds.indexOf(f.fId) : Infinity,
          selectedOfferingIds.indexOf(f.hId) >= 0 ? selectedOfferingIds.indexOf(f.hId) : Infinity,
        )
        chosenFamily = families.sort((a, b) => indexOf(a) - indexOf(b))[0]
      }

      // Remove non-chosen family offerings from selectedOfferingIds
      for (const f of families) {
        if (f === chosenFamily) continue
        const removeIds = new Set([f.legacyId, f.fId, f.hId])
        selectedOfferingIds = selectedOfferingIds.filter(id => !removeIds.has(id))
      }
    }

    // Only mark as pending if both F and H are present (came from migration)
    const hasF = selectedOfferingIds.includes(chosenFamily.fId)
    const hasH = selectedOfferingIds.includes(chosenFamily.hId)

    if (hasF && hasH) {
      pending.add(subjectId)
      boardIds.set(subjectId, chosenFamily.boardId)
      compatOfferings.set(subjectId, [chosenFamily.fId, chosenFamily.hId])
    }
  }

  // Build dedup map for pending subjects (build tier map once)
  if (pending.size > 0) {
    const tierMap = buildTierPairTopicMap(seedData)
    for (const [topicId, { legacyGroupKey }] of tierMap) {
      const topic = seedData.topics.find(t => t.id === topicId)
      if (!topic) continue
      const offering = seedData.offerings.find(o => o.id === topic.offeringId)
      if (!offering || !pending.has(offering.subjectId)) continue
      dedupeMap.set(topicId, legacyGroupKey)
    }
  }

  return {
    pendingTierConfirmations: pending,
    pendingTierBoardIds: boardIds,
    compatSelectedOfferingIds: compatOfferings,
    compatTopicDedupeMap: dedupeMap,
    cleanedSelectedOfferingIds: selectedOfferingIds,
  }
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

  // Non-persisted tier-split compat state
  pendingTierConfirmations: new Set(),
  pendingTierBoardIds: new Map(),
  compatSelectedOfferingIds: new Map(),
  tierPairTopicMap: new Map(),
  compatTopicDedupeMap: new Map(),

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

    // Build tier pair topic map (durable, rebuilt every init from seed)
    const tierPairTopicMap = buildTierPairTopicMap(seed)

    // Compute compat state for tier-split subjects (includes board-family disambiguation)
    const compat = computeCompatState(state, seed)
    state.selectedOfferingIds = compat.cleanedSelectedOfferingIds

    set({
      ...state,
      initialized: true,
      tierPairTopicMap,
      pendingTierConfirmations: compat.pendingTierConfirmations,
      pendingTierBoardIds: compat.pendingTierBoardIds,
      compatSelectedOfferingIds: compat.compatSelectedOfferingIds,
      compatTopicDedupeMap: compat.compatTopicDedupeMap,
    })
    await saveToIdb(state)
  },

  logSession: (topicId: string, rawScore: number, today: Date, durationSeconds?: number, source?: ScheduleSource) => {
    const normalizedScore = rawScore / 100
    const state = get()
    const targetTopicIds = resolveCompatWriteTargets(state, topicId)
    const todayISO = getLocalDayKey(today)

    const updatedTopics = [...state.topics]
    const newSessions: Session[] = []
    const originId = `${topicId}-${Date.now()}`

    for (const tid of targetTopicIds) {
      const idx = updatedTopics.findIndex((t) => t.id === tid)
      if (idx === -1) continue

      const topic = updatedTopics[idx]
      const newPerf = updatePerformance(topic.performanceScore, normalizedScore)
      const newConf = adjustConfidence(topic.confidence, normalizedScore)

      updatedTopics[idx] = {
        ...topic,
        performanceScore: newPerf,
        confidence: newConf,
        lastReviewed: todayISO,
      }

      newSessions.push({
        id: targetTopicIds.length > 1 ? makeCompatCloneId(originId, tid) : originId,
        topicId: tid,
        date: todayISO,
        score: normalizedScore,
        timestamp: Date.now(),
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
        ...(source !== undefined ? { source } : {}),
      })
    }

    set({
      topics: updatedTopics,
      sessions: [...state.sessions, ...newSessions],
    })
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
    // Route pending tier-split subjects through tier-aware actions first
    const preState = get()
    if (preState.pendingTierConfirmations.size > 0) {
      for (const subjectId of Array.from(preState.pendingTierConfirmations)) {
        const tierOid = offeringIds.find(oid => {
          const off = preState.offerings.find(o => o.id === oid)
          return off && off.subjectId === subjectId
        })
        if (tierOid) {
          get().confirmTierSelection(subjectId, tierOid)
        } else {
          get().dismissPendingSubject(subjectId)
        }
      }
    }

    // Derive final selectedOfferingIds: store-authoritative for tier subjects,
    // caller-authoritative for non-tier subjects.
    const state = get()
    const finalIds = mergeTierAuthoritative(offeringIds, state.selectedOfferingIds, state.offerings)
    const kept = new Set(finalIds)

    const topics = state.topics.map((t) => {
      if (!kept.has(t.offeringId)) return t
      const conf = confidences.get(t.offeringId)
      return conf !== undefined ? { ...t, confidence: conf } : t
    })

    set({ topics, selectedOfferingIds: finalIds, onboarded: true })
    saveToIdb(extractPersisted(get()))
  },

  updateSelectedOfferings: (offeringIds: string[], confidences: Map<string, number>) => {
    // Route pending tier-split subjects through tier-aware actions first
    const preState = get()
    if (preState.pendingTierConfirmations.size > 0) {
      for (const subjectId of Array.from(preState.pendingTierConfirmations)) {
        // Count how many distinct tier offerings the caller sends for this subject
        const tierOids = offeringIds.filter(oid => {
          if (TIER_SPLIT_MAP[oid]) return false // legacy ID — not a real tier choice
          const off = preState.offerings.find(o => o.id === oid)
          return off && off.subjectId === subjectId && ALL_TIER_OFFERING_IDS.has(oid)
        })
        if (tierOids.length === 1) {
          // Single tier → explicit confirmation
          get().confirmTierSelection(subjectId, tierOids[0])
        } else if (tierOids.length === 0) {
          // No tier offerings → subject was deselected
          get().dismissPendingSubject(subjectId)
        }
        // length >= 2: both F+H present → keep pending (no action)
      }
    }

    // Detect tier switches for already-confirmed subjects:
    // If persisted has maths-aqa-f but caller sends maths-aqa-h, route through switchTierSelection
    const midState = get()
    const normalizedCaller = normalizeTierSelections(offeringIds, midState.offerings)
    const currentSet = new Set(midState.selectedOfferingIds)
    for (const oid of normalizedCaller) {
      if (!ALL_TIER_OFFERING_IDS.has(oid)) continue
      if (currentSet.has(oid)) continue
      const off = midState.offerings.find(o => o.id === oid)
      if (!off) continue
      const currentTierOid = midState.selectedOfferingIds.find(cid => {
        if (!ALL_TIER_OFFERING_IDS.has(cid)) return false
        const coff = midState.offerings.find(o => o.id === cid)
        return coff && coff.subjectId === off.subjectId
      })
      if (currentTierOid && currentTierOid !== oid) {
        get().switchTierSelection(off.subjectId, currentTierOid, oid)
      }
    }

    // Derive final selectedOfferingIds: store-authoritative for tier subjects
    // (actions already ran), caller-authoritative for non-tier subjects.
    const state = get()
    const mergedIds = mergeTierAuthoritative(offeringIds, state.selectedOfferingIds, state.offerings)

    // Re-inject both F+H for still-pending subjects (mergeTierAuthoritative dedupes to one)
    const finalIds = [...mergedIds]
    for (const sid of state.pendingTierConfirmations) {
      const compat = state.compatSelectedOfferingIds.get(sid)
      if (compat) {
        for (const oid of compat) {
          if (!finalIds.includes(oid)) finalIds.push(oid)
        }
      }
    }

    const previouslySelected = new Set(state.selectedOfferingIds)

    const topics = state.topics.map((t) => {
      if (!finalIds.includes(t.offeringId)) return t
      if (previouslySelected.has(t.offeringId)) return t
      const conf = confidences.get(t.offeringId)
      return conf !== undefined ? { ...t, confidence: conf } : t
    })

    set({ topics, selectedOfferingIds: finalIds })
    saveToIdb(extractPersisted(get()))
  },

  addNote: (topicId: string, text: string) => {
    const state = get()
    const targetTopicIds = resolveCompatWriteTargets(state, topicId)
    const originId = `note-${Date.now()}`
    const newNotes: Note[] = targetTopicIds.map(tid => ({
      id: targetTopicIds.length > 1 ? makeCompatCloneId(originId, tid) : originId,
      topicId: tid,
      date: getLocalDayKey(new Date()),
      text,
    }))
    set({ notes: [...state.notes, ...newNotes] })
    saveToIdb(extractPersisted(get()))
  },

  removeNoteById: (noteId: string) => {
    const state = get()
    const siblings = resolveCompatRecordSiblings(state, noteId, state.notes)
    const toRemove = new Set(siblings)
    set({ notes: state.notes.filter(n => !toRemove.has(n.id)) })
    saveToIdb(extractPersisted(get()))
  },

  updateNoteById: (noteId: string, text: string) => {
    const state = get()
    const siblings = resolveCompatRecordSiblings(state, noteId, state.notes)
    const siblingSet = new Set(siblings)
    set({ notes: state.notes.map(n => siblingSet.has(n.id) ? { ...n, text } : n) })
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
    const targetTopicIds = resolveCompatWriteTargets(state, topicId)
    const originId = `si-${Date.now()}`

    const newItems: ScheduleItem[] = []
    for (const tid of targetTopicIds) {
      if (currentItems.length + newItems.length >= TOTAL_BLOCKS) break
      if (currentItems.some((i) => i.topicId === tid)) continue
      if (newItems.some((i) => i.topicId === tid)) continue
      newItems.push({
        id: targetTopicIds.length > 1 ? makeCompatCloneId(originId, tid) : originId,
        topicId: tid,
        source,
        addedAt: Date.now(),
        dayKey,
      })
    }
    if (newItems.length === 0) return
    set({ dailyPlan: [...currentItems, ...newItems], planDay: dayKey })
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
    const rawItems = autoFillPlanItems(scored, currentItems, dayKey, Date.now(), today, mode)

    // Mirror auto-filled plan items for pending tier-split subjects
    const mirroredItems: ScheduleItem[] = []
    for (const item of rawItems) {
      const targetTopicIds = resolveCompatWriteTargets(state, item.topicId)
      if (targetTopicIds.length <= 1) {
        mirroredItems.push(item)
      } else {
        const originId = item.id
        for (const tid of targetTopicIds) {
          mirroredItems.push({
            ...item,
            id: makeCompatCloneId(originId, tid),
            topicId: tid,
          })
        }
      }
    }

    set({ dailyPlan: [...currentItems, ...mirroredItems], planDay: dayKey })
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

    set({ papers, topics, sessions, notes, dailyPlan })
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
    return {
      topicCount: removedTopics.length,
      sessionCount: state.sessions.filter(s => topicIds.has(s.topicId)).length,
      noteCount: state.notes.filter(n => topicIds.has(n.topicId)).length,
      planCount: state.dailyPlan.filter(i => topicIds.has(i.topicId)).length,
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
      notes: state.notes.filter(n => !topicIds.has(n.topicId)),
      dailyPlan: state.dailyPlan.filter(i => !topicIds.has(i.topicId)),
    })
    saveToIdb(extractPersisted(get()))
  },

  confirmTierSelection: (subjectId: string, offeringId: string) => {
    const state = get()
    if (!state.pendingTierConfirmations.has(subjectId)) return

    // 1. Derive confirmed-tier topic IDs
    const confirmedTopicIds = new Set(
      state.topics.filter(t => t.offeringId === offeringId).map(t => t.id)
    )

    // 2. Find non-confirmed tier topic IDs via tierPairTopicMap
    const nonConfirmedTopicIds = new Set<string>()
    for (const tid of confirmedTopicIds) {
      const pair = state.tierPairTopicMap.get(tid)
      if (pair) nonConfirmedTopicIds.add(pair.pairTopicId)
    }

    // 3. Delete compat sibling copies on non-confirmed tier
    const sessions = state.sessions.filter(s => {
      if (!nonConfirmedTopicIds.has(s.topicId)) return true
      const origin = getMigrationOriginId(s.id)
      if (!origin) return true // standalone historical record — keep unreachable
      // Check if confirmed tier has sibling with same origin
      const hasSibling = state.sessions.some(cs =>
        confirmedTopicIds.has(cs.topicId) && getMigrationOriginId(cs.id) === origin
      )
      return !hasSibling
    })

    const notes = state.notes.filter(n => {
      if (!nonConfirmedTopicIds.has(n.topicId)) return true
      const origin = getMigrationOriginId(n.id)
      if (!origin) return true
      const hasSibling = state.notes.some(cn =>
        confirmedTopicIds.has(cn.topicId) && getMigrationOriginId(cn.id) === origin
      )
      return !hasSibling
    })

    const dailyPlan = state.dailyPlan.filter(i => {
      if (!nonConfirmedTopicIds.has(i.topicId)) return true
      const origin = getMigrationOriginId(i.id)
      if (!origin) return true
      const hasSibling = state.dailyPlan.some(ci =>
        confirmedTopicIds.has(ci.topicId) && getMigrationOriginId(ci.id) === origin
      )
      return !hasSibling
    })

    // 4. Normalize selectedOfferingIds: remove all tier-family IDs, add confirmed
    const canonicalBoardId = state.pendingTierBoardIds.get(subjectId)
    let selectedOfferingIds = [...state.selectedOfferingIds]
    if (canonicalBoardId) {
      const familyIds = new Set(getTierFamilyOfferingIds(seed, subjectId, canonicalBoardId))
      selectedOfferingIds = selectedOfferingIds.filter(id => !familyIds.has(id))
    }
    if (!selectedOfferingIds.includes(offeringId)) {
      selectedOfferingIds.push(offeringId)
    }

    // 5. Clear compat state for this subject
    const pendingTierConfirmations = new Set(state.pendingTierConfirmations)
    pendingTierConfirmations.delete(subjectId)
    const pendingTierBoardIds = new Map(state.pendingTierBoardIds)
    pendingTierBoardIds.delete(subjectId)
    const compatSelectedOfferingIds = new Map(state.compatSelectedOfferingIds)
    compatSelectedOfferingIds.delete(subjectId)
    const compatTopicDedupeMap = new Map(state.compatTopicDedupeMap)
    for (const [tid] of state.compatTopicDedupeMap) {
      const topic = state.topics.find(t => t.id === tid)
      if (topic) {
        const off = state.offerings.find(o => o.id === topic.offeringId)
        if (off && off.subjectId === subjectId) compatTopicDedupeMap.delete(tid)
      }
    }

    set({
      selectedOfferingIds,
      sessions,
      notes,
      dailyPlan,
      pendingTierConfirmations,
      pendingTierBoardIds,
      compatSelectedOfferingIds,
      compatTopicDedupeMap,
    })
    saveToIdb(extractPersisted(get()))
  },

  switchTierSelection: (subjectId: string, fromOfferingId: string, toOfferingId: string) => {
    const state = get()

    // 1. Derive topic mappings
    const fromTopicIds = state.topics.filter(t => t.offeringId === fromOfferingId).map(t => t.id)

    // 2. Transfer topic-level study fields via tierPairTopicMap
    const updatedTopics = [...state.topics]
    for (const fromTid of fromTopicIds) {
      const pair = state.tierPairTopicMap.get(fromTid)
      if (!pair) continue
      const fromIdx = updatedTopics.findIndex(t => t.id === fromTid)
      const toIdx = updatedTopics.findIndex(t => t.id === pair.pairTopicId)
      if (fromIdx === -1 || toIdx === -1) continue
      const fromTopic = updatedTopics[fromIdx]
      const toTopic = updatedTopics[toIdx]
      // Merge: newer lastReviewed wins; if equal, keep higher confidence
      const fromDate = fromTopic.lastReviewed ?? ''
      const toDate = toTopic.lastReviewed ?? ''
      if (fromDate > toDate || (fromDate === toDate && fromTopic.confidence > toTopic.confidence)) {
        updatedTopics[toIdx] = {
          ...toTopic,
          confidence: fromTopic.confidence,
          performanceScore: fromTopic.performanceScore,
          lastReviewed: fromTopic.lastReviewed,
        }
      }
    }

    // 3. Clone sessions/notes/planItems to target tier (dedupe by origin)
    const sessions = [...state.sessions]
    const notes = [...state.notes]
    const dailyPlan = [...state.dailyPlan]

    for (const fromTid of fromTopicIds) {
      const pair = state.tierPairTopicMap.get(fromTid)
      if (!pair) continue
      const toTid = pair.pairTopicId

      // Sessions
      const fromSessions = sessions.filter(s => s.topicId === fromTid)
      const existingOrigins = new Set(
        sessions.filter(s => s.topicId === toTid).map(s => getMigrationOriginId(s.id) ?? s.id)
      )
      for (const s of fromSessions) {
        const originId = getMigrationOriginId(s.id) ?? s.id
        if (existingOrigins.has(originId)) {
          // Destination exists — patch if source is newer
          const destIdx = sessions.findIndex(ds =>
            ds.topicId === toTid && (getMigrationOriginId(ds.id) ?? ds.id) === originId
          )
          if (destIdx >= 0 && (s.timestamp ?? 0) > (sessions[destIdx].timestamp ?? 0)) {
            sessions[destIdx] = { ...sessions[destIdx], score: s.score, timestamp: s.timestamp ?? 0 }
          }
        } else {
          sessions.push({
            ...s,
            id: makeCompatCloneId(originId, toTid),
            topicId: toTid,
          })
        }
      }

      // Notes
      const fromNotes = notes.filter(n => n.topicId === fromTid)
      const existingNoteOrigins = new Set(
        notes.filter(n => n.topicId === toTid).map(n => getMigrationOriginId(n.id) ?? n.id)
      )
      for (const n of fromNotes) {
        const originId = getMigrationOriginId(n.id) ?? n.id
        if (!existingNoteOrigins.has(originId)) {
          notes.push({
            ...n,
            id: makeCompatCloneId(originId, toTid),
            topicId: toTid,
          })
        }
      }

      // Plan items
      const fromPlanItems = dailyPlan.filter(i => i.topicId === fromTid)
      const existingPlanOrigins = new Set(
        dailyPlan.filter(i => i.topicId === toTid).map(i => getMigrationOriginId(i.id) ?? i.id)
      )
      for (const item of fromPlanItems) {
        const originId = getMigrationOriginId(item.id) ?? item.id
        if (!existingPlanOrigins.has(originId)) {
          dailyPlan.push({
            ...item,
            id: makeCompatCloneId(originId, toTid),
            topicId: toTid,
          })
        }
      }
    }

    // 4. Normalize selectedOfferingIds
    let selectedOfferingIds = [...state.selectedOfferingIds]
    try {
      const boardId = getTierFamilyBoardId(seed, subjectId, fromOfferingId)
      const familyIds = new Set(getTierFamilyOfferingIds(seed, subjectId, boardId))
      selectedOfferingIds = selectedOfferingIds.filter(id => !familyIds.has(id))
    } catch (error) {
      if (__E2E_BRIDGE__ || import.meta.env.DEV || import.meta.env.MODE === 'test') throw error
      return
    }
    if (!selectedOfferingIds.includes(toOfferingId)) {
      selectedOfferingIds.push(toOfferingId)
    }

    set({ topics: updatedTopics, sessions, notes, dailyPlan, selectedOfferingIds })
    saveToIdb(extractPersisted(get()))
  },

  dismissPendingSubject: (subjectId: string) => {
    const state = get()

    // Remove all tier-family offerings from persisted selection
    const canonicalBoardId = state.pendingTierBoardIds.get(subjectId)
    let selectedOfferingIds = [...state.selectedOfferingIds]
    if (canonicalBoardId) {
      const familyIds = new Set(getTierFamilyOfferingIds(seed, subjectId, canonicalBoardId))
      selectedOfferingIds = selectedOfferingIds.filter(id => !familyIds.has(id))
    }

    // Clear compat state (but retain pendingTierBoardIds for re-add)
    const pendingTierConfirmations = new Set(state.pendingTierConfirmations)
    pendingTierConfirmations.delete(subjectId)
    const compatSelectedOfferingIds = new Map(state.compatSelectedOfferingIds)
    compatSelectedOfferingIds.delete(subjectId)
    const compatTopicDedupeMap = new Map(state.compatTopicDedupeMap)
    for (const [tid] of state.compatTopicDedupeMap) {
      const topic = state.topics.find(t => t.id === tid)
      if (topic) {
        const off = state.offerings.find(o => o.id === topic.offeringId)
        if (off && off.subjectId === subjectId) compatTopicDedupeMap.delete(tid)
      }
    }

    set({
      selectedOfferingIds,
      pendingTierConfirmations,
      compatSelectedOfferingIds,
      compatTopicDedupeMap,
    })
    saveToIdb(extractPersisted(get()))
  },

  resetAll: async () => {
    const freshSeed = deepCloneSeed()
    set({ ...freshSeed, initialized: true })
    await saveToIdb(freshSeed)
  },
}))
