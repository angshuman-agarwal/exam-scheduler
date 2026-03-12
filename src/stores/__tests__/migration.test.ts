import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  useAppStore,
  TIER_SPLIT_MAP,
  PAPER_SPLIT_MAP,
  makeCompatCloneId,
  getMigrationOriginId,
  getTierFamilyOfferingIds,
  getTierFamilyBoardId,
} from '../app.store'
import seedData from '../../data/subjects.json'
import type { SeedDataV2 } from '../../types'
import { normalizeTopic } from '../../data/templates'

// Mock IDB so store actions don't hit real IndexedDB
vi.mock('../../lib/idb', () => ({
  loadFromIdbRaw: vi.fn().mockResolvedValue(undefined),
  saveToIdbRaw: vi.fn().mockResolvedValue(undefined),
}))

const seed = seedData as SeedDataV2

// ── Helpers ──

/** Build the tier-pair topic map the same way the store does internally */
function buildTestTierPairMap() {
  const map = new Map<string, { pairTopicId: string; legacyGroupKey: string }>()
  for (const [legacyOfferingId, [fOfferingId, hOfferingId]] of Object.entries(TIER_SPLIT_MAP)) {
    const paperPairs: [string, string][] = []
    for (const [, [fPid, hPid]] of Object.entries(PAPER_SPLIT_MAP)) {
      if (
        seed.papers.some((p) => p.id === fPid && p.offeringId === fOfferingId) &&
        seed.papers.some((p) => p.id === hPid && p.offeringId === hOfferingId)
      ) {
        paperPairs.push([fPid, hPid])
      }
    }
    for (const [fPaperId, hPaperId] of paperPairs) {
      const fTopics = seed.topics.filter((t) => t.offeringId === fOfferingId && t.paperId === fPaperId)
      const hTopics = seed.topics.filter((t) => t.offeringId === hOfferingId && t.paperId === hPaperId)
      const hByName = new Map(hTopics.map((t) => [normalizeTopic(t.name), t]))
      for (const ft of fTopics) {
        const ht = hByName.get(normalizeTopic(ft.name))
        if (ht) {
          const key = `${legacyOfferingId}|${normalizeTopic(ft.name)}`
          map.set(ft.id, { pairTopicId: ht.id, legacyGroupKey: key })
          map.set(ht.id, { pairTopicId: ft.id, legacyGroupKey: key })
        }
      }
    }
  }
  return map
}

/** Build the compat topic dedupe map for a set of pending subject IDs */
function buildTestCompatDedupeMap(pendingSubjectIds: Set<string>) {
  const tierMap = buildTestTierPairMap()
  const dedupeMap = new Map<string, string>()
  for (const [topicId, { legacyGroupKey }] of tierMap) {
    const topic = seed.topics.find((t) => t.id === topicId)
    if (!topic) continue
    const offering = seed.offerings.find((o) => o.id === topic.offeringId)
    if (!offering || !pendingSubjectIds.has(offering.subjectId)) continue
    dedupeMap.set(topicId, legacyGroupKey)
  }
  return dedupeMap
}

/** Set up the store with a pending maths-aqa tier confirmation */
function setupPendingMathsAqa() {
  const pendingSubjects = new Set(['maths'])
  useAppStore.setState({
    boards: JSON.parse(JSON.stringify(seed.boards)),
    subjects: JSON.parse(JSON.stringify(seed.subjects)),
    offerings: JSON.parse(JSON.stringify(seed.offerings)),
    papers: JSON.parse(JSON.stringify(seed.papers)),
    topics: JSON.parse(JSON.stringify(seed.topics)),
    sessions: [],
    notes: [],
    dailyPlan: [],
    selectedOfferingIds: ['maths-aqa-f', 'maths-aqa-h'],
    onboarded: true,
    initialized: true,
    studyMode: 'gcse',
    pendingTierConfirmations: pendingSubjects,
    pendingTierBoardIds: new Map([['maths', 'aqa']]),
    compatSelectedOfferingIds: new Map([['maths', ['maths-aqa-f', 'maths-aqa-h']]]),
    tierPairTopicMap: buildTestTierPairMap(),
    compatTopicDedupeMap: buildTestCompatDedupeMap(pendingSubjects),
  })
}

/** Get a foundation topic ID and its higher pair for maths-aqa */
function getMathsAqaTopicPair(): { fTopicId: string; hTopicId: string } {
  const tierMap = buildTestTierPairMap()
  const fTopic = seed.topics.find((t) => t.offeringId === 'maths-aqa-f')!
  const pair = tierMap.get(fTopic.id)!
  return { fTopicId: fTopic.id, hTopicId: pair.pairTopicId }
}

// ── Reset store before each test ──

beforeEach(() => {
  useAppStore.setState({
    version: 2,
    boards: JSON.parse(JSON.stringify(seed.boards)),
    subjects: JSON.parse(JSON.stringify(seed.subjects)),
    offerings: JSON.parse(JSON.stringify(seed.offerings)),
    papers: JSON.parse(JSON.stringify(seed.papers)),
    topics: JSON.parse(JSON.stringify(seed.topics)),
    sessions: [],
    notes: [],
    userState: { energyLevel: 3, stress: 2 },
    onboarded: true,
    initialized: true,
    selectedOfferingIds: [],
    dailyPlan: [],
    planDay: '',
    studyMode: 'gcse',
    customBoards: [],
    customSubjects: [],
    customOfferings: [],
    customPapers: [],
    customTopics: [],
    pendingTierConfirmations: new Set(),
    pendingTierBoardIds: new Map(),
    compatSelectedOfferingIds: new Map(),
    tierPairTopicMap: new Map(),
    compatTopicDedupeMap: new Map(),
  })
})

// ═══════════════════════════════════════════════════════════════════
// 1. Compat clone ID helpers
// ═══════════════════════════════════════════════════════════════════

describe('makeCompatCloneId / getMigrationOriginId', () => {
  it('roundtrips: origin ID is extractable from a compat clone ID', () => {
    const originId = 'sess-12345'
    const targetTopicId = 'maths-aqa-h-001'
    const cloneId = makeCompatCloneId(originId, targetTopicId)
    expect(getMigrationOriginId(cloneId)).toBe(originId)
  })

  it('returns null for non-migrated IDs', () => {
    expect(getMigrationOriginId('sess-12345')).toBeNull()
    expect(getMigrationOriginId('plain-id')).toBeNull()
  })

  it('produces unique clone IDs for different target topics', () => {
    const origin = 'note-999'
    const cloneA = makeCompatCloneId(origin, 'maths-aqa-f-001')
    const cloneB = makeCompatCloneId(origin, 'maths-aqa-h-001')
    expect(cloneA).not.toBe(cloneB)
    expect(getMigrationOriginId(cloneA)).toBe(origin)
    expect(getMigrationOriginId(cloneB)).toBe(origin)
  })

  it('handles nested migrated IDs (double migration) correctly', () => {
    const first = makeCompatCloneId('original', 'target-1')
    const second = makeCompatCloneId(first, 'target-2')
    // getMigrationOriginId extracts up to the first delimiter
    expect(getMigrationOriginId(second)).toBe('original')
  })
})

// ═══════════════════════════════════════════════════════════════════
// 2. Tier-family helpers
// ═══════════════════════════════════════════════════════════════════

describe('getTierFamilyBoardId', () => {
  it('resolves board ID from a Foundation offering ID', () => {
    expect(getTierFamilyBoardId(seed, 'maths', 'maths-aqa-f')).toBe('aqa')
  })

  it('resolves board ID from a Higher offering ID', () => {
    expect(getTierFamilyBoardId(seed, 'maths', 'maths-aqa-h')).toBe('aqa')
  })

  it('resolves board ID from a legacy offering ID via TIER_SPLIT_MAP', () => {
    expect(getTierFamilyBoardId(seed, 'maths', 'maths-aqa')).toBe('aqa')
  })

  it('throws for unknown offering IDs', () => {
    expect(() => getTierFamilyBoardId(seed, 'maths', 'maths-fake-f')).toThrow()
  })

  it('resolves for all TIER_SPLIT_MAP entries', () => {
    for (const [legacyId, [fId, hId]] of Object.entries(TIER_SPLIT_MAP)) {
      const fOff = seed.offerings.find((o) => o.id === fId)!
      const subjectId = fOff.subjectId
      expect(getTierFamilyBoardId(seed, subjectId, legacyId)).toBe(fOff.boardId)
      expect(getTierFamilyBoardId(seed, subjectId, fId)).toBe(fOff.boardId)
      expect(getTierFamilyBoardId(seed, subjectId, hId)).toBe(fOff.boardId)
    }
  })
})

describe('getTierFamilyOfferingIds', () => {
  it('returns legacy + F + H for maths/aqa', () => {
    const ids = getTierFamilyOfferingIds(seed, 'maths', 'aqa')
    expect(ids).toContain('maths-aqa')
    expect(ids).toContain('maths-aqa-f')
    expect(ids).toContain('maths-aqa-h')
    expect(ids).toHaveLength(3)
  })

  it('returns legacy + F + H for maths/edexcel', () => {
    const ids = getTierFamilyOfferingIds(seed, 'maths', 'edexcel')
    expect(ids).toContain('maths-edexcel')
    expect(ids).toContain('maths-edexcel-f')
    expect(ids).toContain('maths-edexcel-h')
    expect(ids).toHaveLength(3)
  })

  it('returns legacy + F + H for all science subjects', () => {
    for (const prefix of ['bio', 'chem', 'phys']) {
      const ids = getTierFamilyOfferingIds(seed, prefix, 'aqa')
      expect(ids).toHaveLength(3)
      expect(ids).toContain(`${prefix}-aqa`)
      expect(ids).toContain(`${prefix}-aqa-f`)
      expect(ids).toContain(`${prefix}-aqa-h`)
    }
  })

  it('returns empty for a non-tiered subject', () => {
    const ids = getTierFamilyOfferingIds(seed, 'english-lang', 'aqa')
    expect(ids).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 3. confirmTierSelection
// ═══════════════════════════════════════════════════════════════════

describe('confirmTierSelection', () => {
  it('clears pending state for the confirmed subject', () => {
    setupPendingMathsAqa()
    useAppStore.getState().confirmTierSelection('maths', 'maths-aqa-h')
    const state = useAppStore.getState()
    expect(state.pendingTierConfirmations.has('maths')).toBe(false)
    expect(state.pendingTierBoardIds.has('maths')).toBe(false)
    expect(state.compatSelectedOfferingIds.has('maths')).toBe(false)
  })

  it('sets selectedOfferingIds to only the confirmed offering', () => {
    setupPendingMathsAqa()
    useAppStore.getState().confirmTierSelection('maths', 'maths-aqa-h')
    const state = useAppStore.getState()
    expect(state.selectedOfferingIds).toContain('maths-aqa-h')
    expect(state.selectedOfferingIds).not.toContain('maths-aqa-f')
    expect(state.selectedOfferingIds).not.toContain('maths-aqa')
  })

  it('removes compat topic dedupe entries for the confirmed subject', () => {
    setupPendingMathsAqa()
    const preDedupe = useAppStore.getState().compatTopicDedupeMap
    expect(preDedupe.size).toBeGreaterThan(0)

    useAppStore.getState().confirmTierSelection('maths', 'maths-aqa-f')
    const postDedupe = useAppStore.getState().compatTopicDedupeMap
    // All maths entries should be cleared
    for (const [tid] of postDedupe) {
      const topic = seed.topics.find((t) => t.id === tid)
      if (topic) {
        const off = seed.offerings.find((o) => o.id === topic.offeringId)
        expect(off?.subjectId).not.toBe('maths')
      }
    }
  })

  it('removes compat-cloned sessions on the non-confirmed tier', () => {
    setupPendingMathsAqa()
    const { fTopicId, hTopicId } = getMathsAqaTopicPair()

    // Simulate cloned sessions (as mergeWithFreshSeed would create)
    const originId = 'legacy-sess-1'
    useAppStore.setState({
      sessions: [
        { id: makeCompatCloneId(originId, fTopicId), topicId: fTopicId, date: '2026-03-10', score: 0.8, timestamp: 100 },
        { id: makeCompatCloneId(originId, hTopicId), topicId: hTopicId, date: '2026-03-10', score: 0.8, timestamp: 100 },
      ],
    })

    // Confirm Higher → Foundation clone should be removed
    useAppStore.getState().confirmTierSelection('maths', 'maths-aqa-h')
    const sessions = useAppStore.getState().sessions
    const hSessions = sessions.filter((s) => s.topicId === hTopicId)
    const fSessions = sessions.filter((s) => s.topicId === fTopicId)
    expect(hSessions).toHaveLength(1)
    expect(fSessions).toHaveLength(0)
  })

  it('removes compat-cloned notes on the non-confirmed tier', () => {
    setupPendingMathsAqa()
    const { fTopicId, hTopicId } = getMathsAqaTopicPair()

    const originId = 'legacy-note-1'
    useAppStore.setState({
      notes: [
        { id: makeCompatCloneId(originId, fTopicId), topicId: fTopicId, date: '2026-03-10', text: 'test' },
        { id: makeCompatCloneId(originId, hTopicId), topicId: hTopicId, date: '2026-03-10', text: 'test' },
      ],
    })

    useAppStore.getState().confirmTierSelection('maths', 'maths-aqa-f')
    const notes = useAppStore.getState().notes
    expect(notes.filter((n) => n.topicId === fTopicId)).toHaveLength(1)
    expect(notes.filter((n) => n.topicId === hTopicId)).toHaveLength(0)
  })

  it('removes compat-cloned plan items on the non-confirmed tier', () => {
    setupPendingMathsAqa()
    const { fTopicId, hTopicId } = getMathsAqaTopicPair()

    const originId = 'legacy-plan-1'
    useAppStore.setState({
      dailyPlan: [
        { id: makeCompatCloneId(originId, fTopicId), topicId: fTopicId, source: 'manual' as const, addedAt: 100, dayKey: '2026-03-12' },
        { id: makeCompatCloneId(originId, hTopicId), topicId: hTopicId, source: 'manual' as const, addedAt: 100, dayKey: '2026-03-12' },
      ],
    })

    useAppStore.getState().confirmTierSelection('maths', 'maths-aqa-h')
    const plan = useAppStore.getState().dailyPlan
    expect(plan.filter((i) => i.topicId === hTopicId)).toHaveLength(1)
    expect(plan.filter((i) => i.topicId === fTopicId)).toHaveLength(0)
  })

  it('keeps standalone (non-cloned) sessions on non-confirmed tier as unreachable', () => {
    setupPendingMathsAqa()
    const { fTopicId, hTopicId } = getMathsAqaTopicPair()

    // A standalone session (no -migrated- in ID) on the non-confirmed tier
    useAppStore.setState({
      sessions: [
        { id: 'standalone-sess', topicId: fTopicId, date: '2026-03-10', score: 0.5, timestamp: 50 },
        { id: makeCompatCloneId('origin', hTopicId), topicId: hTopicId, date: '2026-03-10', score: 0.5, timestamp: 50 },
      ],
    })

    // Confirm Higher — standalone on F is kept (unreachable but not deleted)
    useAppStore.getState().confirmTierSelection('maths', 'maths-aqa-h')
    const sessions = useAppStore.getState().sessions
    expect(sessions.some((s) => s.id === 'standalone-sess')).toBe(true)
  })

  it('is a no-op if subject is not in pending set', () => {
    setupPendingMathsAqa()
    const before = useAppStore.getState().selectedOfferingIds
    useAppStore.getState().confirmTierSelection('bio', 'bio-aqa-f')
    expect(useAppStore.getState().selectedOfferingIds).toEqual(before)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 4. dismissPendingSubject
// ═══════════════════════════════════════════════════════════════════

describe('dismissPendingSubject', () => {
  it('clears compat state without deleting sessions/notes', () => {
    setupPendingMathsAqa()
    const { fTopicId, hTopicId } = getMathsAqaTopicPair()

    const originId = 'legacy-sess'
    useAppStore.setState({
      sessions: [
        { id: makeCompatCloneId(originId, fTopicId), topicId: fTopicId, date: '2026-03-10', score: 0.7, timestamp: 100 },
        { id: makeCompatCloneId(originId, hTopicId), topicId: hTopicId, date: '2026-03-10', score: 0.7, timestamp: 100 },
      ],
    })

    useAppStore.getState().dismissPendingSubject('maths')
    const state = useAppStore.getState()

    // Compat state cleared
    expect(state.pendingTierConfirmations.has('maths')).toBe(false)
    expect(state.compatSelectedOfferingIds.has('maths')).toBe(false)

    // Sessions are NOT deleted (they become unreachable)
    expect(state.sessions).toHaveLength(2)
  })

  it('removes tier-family offerings from selectedOfferingIds', () => {
    setupPendingMathsAqa()
    useAppStore.getState().dismissPendingSubject('maths')
    const state = useAppStore.getState()
    expect(state.selectedOfferingIds).not.toContain('maths-aqa-f')
    expect(state.selectedOfferingIds).not.toContain('maths-aqa-h')
    expect(state.selectedOfferingIds).not.toContain('maths-aqa')
  })

  it('clears compat dedupe map entries for the dismissed subject', () => {
    setupPendingMathsAqa()
    expect(useAppStore.getState().compatTopicDedupeMap.size).toBeGreaterThan(0)

    useAppStore.getState().dismissPendingSubject('maths')
    const dedupe = useAppStore.getState().compatTopicDedupeMap
    for (const [tid] of dedupe) {
      const topic = seed.topics.find((t) => t.id === tid)
      if (topic) {
        const off = seed.offerings.find((o) => o.id === topic.offeringId)
        expect(off?.subjectId).not.toBe('maths')
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════════
// 5. switchTierSelection
// ═══════════════════════════════════════════════════════════════════

describe('switchTierSelection', () => {
  it('transfers topic study fields from F to H', () => {
    setupPendingMathsAqa()
    const { fTopicId, hTopicId } = getMathsAqaTopicPair()

    // Give the F topic some study data
    const topics = useAppStore.getState().topics.map((t) => {
      if (t.id === fTopicId) return { ...t, confidence: 5, performanceScore: 0.9, lastReviewed: '2026-03-11' }
      return t
    })
    useAppStore.setState({ topics })

    useAppStore.getState().switchTierSelection('maths', 'maths-aqa-f', 'maths-aqa-h')

    const hTopic = useAppStore.getState().topics.find((t) => t.id === hTopicId)!
    expect(hTopic.confidence).toBe(5)
    expect(hTopic.performanceScore).toBe(0.9)
    expect(hTopic.lastReviewed).toBe('2026-03-11')
  })

  it('clones sessions from source to target tier', () => {
    setupPendingMathsAqa()
    const { fTopicId, hTopicId } = getMathsAqaTopicPair()

    useAppStore.setState({
      sessions: [
        { id: 'sess-1', topicId: fTopicId, date: '2026-03-10', score: 0.8, timestamp: 100 },
      ],
    })

    useAppStore.getState().switchTierSelection('maths', 'maths-aqa-f', 'maths-aqa-h')

    const sessions = useAppStore.getState().sessions
    const hSessions = sessions.filter((s) => s.topicId === hTopicId)
    expect(hSessions).toHaveLength(1)
    expect(getMigrationOriginId(hSessions[0].id)).toBe('sess-1')
  })

  it('clones notes from source to target tier', () => {
    setupPendingMathsAqa()
    const { fTopicId, hTopicId } = getMathsAqaTopicPair()

    useAppStore.setState({
      notes: [{ id: 'note-1', topicId: fTopicId, date: '2026-03-10', text: 'my note' }],
    })

    useAppStore.getState().switchTierSelection('maths', 'maths-aqa-f', 'maths-aqa-h')

    const notes = useAppStore.getState().notes
    const hNotes = notes.filter((n) => n.topicId === hTopicId)
    expect(hNotes).toHaveLength(1)
    expect(hNotes[0].text).toBe('my note')
  })

  it('clones plan items from source to target tier', () => {
    setupPendingMathsAqa()
    const { fTopicId, hTopicId } = getMathsAqaTopicPair()

    useAppStore.setState({
      dailyPlan: [
        { id: 'plan-1', topicId: fTopicId, source: 'manual' as const, addedAt: 100, dayKey: '2026-03-12' },
      ],
    })

    useAppStore.getState().switchTierSelection('maths', 'maths-aqa-f', 'maths-aqa-h')

    const plan = useAppStore.getState().dailyPlan
    const hItems = plan.filter((i) => i.topicId === hTopicId)
    expect(hItems).toHaveLength(1)
  })

  it('updates selectedOfferingIds from source to target', () => {
    setupPendingMathsAqa()
    useAppStore.getState().switchTierSelection('maths', 'maths-aqa-f', 'maths-aqa-h')
    const ids = useAppStore.getState().selectedOfferingIds
    expect(ids).toContain('maths-aqa-h')
    expect(ids).not.toContain('maths-aqa-f')
  })

  it('does not duplicate sessions on repeated switches F→H→F→H', () => {
    setupPendingMathsAqa()
    const { fTopicId, hTopicId } = getMathsAqaTopicPair()

    useAppStore.setState({
      sessions: [
        { id: 'sess-orig', topicId: fTopicId, date: '2026-03-10', score: 0.8, timestamp: 100 },
      ],
    })

    // F→H
    useAppStore.getState().switchTierSelection('maths', 'maths-aqa-f', 'maths-aqa-h')
    // H→F
    useAppStore.getState().switchTierSelection('maths', 'maths-aqa-h', 'maths-aqa-f')
    // F→H again
    useAppStore.getState().switchTierSelection('maths', 'maths-aqa-f', 'maths-aqa-h')

    const sessions = useAppStore.getState().sessions
    // Should not accumulate duplicates — deduplication by origin ID
    const hSessions = sessions.filter((s) => s.topicId === hTopicId)
    const fSessions = sessions.filter((s) => s.topicId === fTopicId)

    // Each topic should have at most one session derived from the original
    const hOrigins = hSessions.map((s) => getMigrationOriginId(s.id) ?? s.id)
    const fOrigins = fSessions.map((s) => getMigrationOriginId(s.id) ?? s.id)
    expect(new Set(hOrigins).size).toBe(hOrigins.length)
    expect(new Set(fOrigins).size).toBe(fOrigins.length)
  })

  it('ends with exactly one offering in selectedOfferingIds after repeated switches', () => {
    setupPendingMathsAqa()
    useAppStore.getState().switchTierSelection('maths', 'maths-aqa-f', 'maths-aqa-h')
    useAppStore.getState().switchTierSelection('maths', 'maths-aqa-h', 'maths-aqa-f')
    useAppStore.getState().switchTierSelection('maths', 'maths-aqa-f', 'maths-aqa-h')

    const ids = useAppStore.getState().selectedOfferingIds
    const mathsTierIds = ids.filter((id) => id.startsWith('maths-aqa-'))
    expect(mathsTierIds).toHaveLength(1)
    expect(mathsTierIds[0]).toBe('maths-aqa-h')
  })
})

// ═══════════════════════════════════════════════════════════════════
// 6. Compat write targets (logSession, addNote, addToPlan)
// ═══════════════════════════════════════════════════════════════════

describe('compat write targets during pending state', () => {
  it('logSession mirrors to both tiers when subject is pending', () => {
    setupPendingMathsAqa()
    const { fTopicId, hTopicId } = getMathsAqaTopicPair()

    useAppStore.getState().logSession(fTopicId, 80, new Date('2026-03-12'))

    const sessions = useAppStore.getState().sessions
    const fSess = sessions.filter((s) => s.topicId === fTopicId)
    const hSess = sessions.filter((s) => s.topicId === hTopicId)
    expect(fSess).toHaveLength(1)
    expect(hSess).toHaveLength(1)
    expect(fSess[0].score).toBe(0.8)
    expect(hSess[0].score).toBe(0.8)
  })

  it('logSession updates confidence on both tier topics', () => {
    setupPendingMathsAqa()
    const { fTopicId, hTopicId } = getMathsAqaTopicPair()

    // Use score > 80 so adjustConfidence actually bumps (threshold is > 0.8)
    useAppStore.getState().logSession(fTopicId, 90, new Date('2026-03-12'))

    const fAfter = useAppStore.getState().topics.find((t) => t.id === fTopicId)!
    const hAfter = useAppStore.getState().topics.find((t) => t.id === hTopicId)!
    // Both should have been updated
    expect(fAfter.lastReviewed).toBe('2026-03-12')
    expect(hAfter.lastReviewed).toBe('2026-03-12')
    // adjustConfidence bumps from 3 → 4 when normalizedScore (0.9) > 0.8
    expect(fAfter.confidence).toBe(4)
    expect(hAfter.confidence).toBe(4)
  })

  it('addNote mirrors to both tiers when subject is pending', () => {
    setupPendingMathsAqa()
    const { fTopicId, hTopicId } = getMathsAqaTopicPair()

    useAppStore.getState().addNote(fTopicId, 'test note')

    const notes = useAppStore.getState().notes
    const fNotes = notes.filter((n) => n.topicId === fTopicId)
    const hNotes = notes.filter((n) => n.topicId === hTopicId)
    expect(fNotes).toHaveLength(1)
    expect(hNotes).toHaveLength(1)
    expect(hNotes[0].text).toBe('test note')
  })

  it('addToPlan mirrors to both tiers when subject is pending', () => {
    setupPendingMathsAqa()
    const { fTopicId, hTopicId } = getMathsAqaTopicPair()

    useAppStore.getState().addToPlan(fTopicId, 'manual', new Date('2026-03-12'))

    const plan = useAppStore.getState().dailyPlan
    const fItems = plan.filter((i) => i.topicId === fTopicId)
    const hItems = plan.filter((i) => i.topicId === hTopicId)
    expect(fItems).toHaveLength(1)
    expect(hItems).toHaveLength(1)
  })

  it('logSession does NOT mirror when subject is NOT pending', () => {
    // No pending state, just a normal session log
    const topic = seed.topics.find((t) => t.offeringId === 'maths-aqa-h')!
    useAppStore.setState({
      ...useAppStore.getState(),
      selectedOfferingIds: ['maths-aqa-h'],
      tierPairTopicMap: buildTestTierPairMap(),
    })

    useAppStore.getState().logSession(topic.id, 80, new Date('2026-03-12'))

    const sessions = useAppStore.getState().sessions
    expect(sessions).toHaveLength(1)
    expect(sessions[0].topicId).toBe(topic.id)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 7. Post-confirm: only confirmed tier's records visible
// ═══════════════════════════════════════════════════════════════════

describe('post-confirm visibility', () => {
  it('after confirming H, only H sessions survive compat cleanup', () => {
    setupPendingMathsAqa()
    const { fTopicId, hTopicId } = getMathsAqaTopicPair()

    // Log a session during pending (mirrors to both)
    useAppStore.getState().logSession(fTopicId, 70, new Date('2026-03-12'))

    // Confirm Higher
    useAppStore.getState().confirmTierSelection('maths', 'maths-aqa-h')

    const sessions = useAppStore.getState().sessions
    const fSessions = sessions.filter((s) => s.topicId === fTopicId)
    const hSessions = sessions.filter((s) => s.topicId === hTopicId)
    // F clone should be removed (it has a sibling on H with same origin)
    expect(fSessions).toHaveLength(0)
    expect(hSessions).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 8. Post-dismiss: records become unreachable
// ═══════════════════════════════════════════════════════════════════

describe('post-dismiss unreachability', () => {
  it('sessions are not deleted on dismiss, but offerings are deselected', () => {
    setupPendingMathsAqa()
    const { fTopicId } = getMathsAqaTopicPair()

    useAppStore.getState().logSession(fTopicId, 60, new Date('2026-03-12'))
    const preCount = useAppStore.getState().sessions.length

    useAppStore.getState().dismissPendingSubject('maths')

    // Sessions still exist
    expect(useAppStore.getState().sessions.length).toBe(preCount)
    // But no maths offerings selected
    const ids = useAppStore.getState().selectedOfferingIds
    expect(ids.filter((id) => id.startsWith('maths-aqa'))).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 9. Board-family disambiguation
// ═══════════════════════════════════════════════════════════════════

describe('board-family disambiguation', () => {
  it('maths-aqa and maths-edexcel are in different tier families', () => {
    const aqaIds = getTierFamilyOfferingIds(seed, 'maths', 'aqa')
    const edexIds = getTierFamilyOfferingIds(seed, 'maths', 'edexcel')
    // No overlap
    const aqaSet = new Set(aqaIds)
    for (const id of edexIds) {
      expect(aqaSet.has(id)).toBe(false)
    }
  })

  it('confirming maths-aqa-h does not affect maths-edexcel offerings', () => {
    // Set up both AQA and Edexcel as selected (edge case)
    const pendingSubjects = new Set(['maths'])
    useAppStore.setState({
      ...useAppStore.getState(),
      selectedOfferingIds: ['maths-aqa-f', 'maths-aqa-h', 'maths-edexcel-f'],
      pendingTierConfirmations: pendingSubjects,
      pendingTierBoardIds: new Map([['maths', 'aqa']]),
      compatSelectedOfferingIds: new Map([['maths', ['maths-aqa-f', 'maths-aqa-h']]]),
      tierPairTopicMap: buildTestTierPairMap(),
      compatTopicDedupeMap: buildTestCompatDedupeMap(pendingSubjects),
    })

    useAppStore.getState().confirmTierSelection('maths', 'maths-aqa-h')
    const ids = useAppStore.getState().selectedOfferingIds
    expect(ids).toContain('maths-aqa-h')
    // Edexcel-f stays because it's not in the AQA tier family
    expect(ids).toContain('maths-edexcel-f')
  })
})

// ═══════════════════════════════════════════════════════════════════
// 10. TIER_SPLIT_MAP / PAPER_SPLIT_MAP structural checks
// ═══════════════════════════════════════════════════════════════════

describe('migration map structural integrity', () => {
  it('every TIER_SPLIT_MAP F and H offering exists in seed', () => {
    for (const [, [fId, hId]] of Object.entries(TIER_SPLIT_MAP)) {
      expect(seed.offerings.some((o) => o.id === fId), `Missing F offering: ${fId}`).toBe(true)
      expect(seed.offerings.some((o) => o.id === hId), `Missing H offering: ${hId}`).toBe(true)
    }
  })

  it('every PAPER_SPLIT_MAP F and H paper exists in seed', () => {
    for (const [, [fPid, hPid]] of Object.entries(PAPER_SPLIT_MAP)) {
      expect(seed.papers.some((p) => p.id === fPid), `Missing F paper: ${fPid}`).toBe(true)
      expect(seed.papers.some((p) => p.id === hPid), `Missing H paper: ${hPid}`).toBe(true)
    }
  })

  it('F and H offerings for a legacy key share the same subject and board', () => {
    for (const [, [fId, hId]] of Object.entries(TIER_SPLIT_MAP)) {
      const fOff = seed.offerings.find((o) => o.id === fId)!
      const hOff = seed.offerings.find((o) => o.id === hId)!
      expect(fOff.subjectId).toBe(hOff.subjectId)
      expect(fOff.boardId).toBe(hOff.boardId)
    }
  })

  it('tier pair topic map has matching F↔H pairs for all TIER_SPLIT_MAP entries', () => {
    const tierMap = buildTestTierPairMap()
    for (const [, [fOfferingId, hOfferingId]] of Object.entries(TIER_SPLIT_MAP)) {
      const fTopics = seed.topics.filter((t) => t.offeringId === fOfferingId)
      let pairedCount = 0
      for (const ft of fTopics) {
        const pair = tierMap.get(ft.id)
        if (pair) {
          pairedCount++
          const hTopic = seed.topics.find((t) => t.id === pair.pairTopicId)
          expect(hTopic).toBeDefined()
          expect(hTopic!.offeringId).toBe(hOfferingId)
          // Bidirectional
          const reverse = tierMap.get(pair.pairTopicId)
          expect(reverse).toBeDefined()
          expect(reverse!.pairTopicId).toBe(ft.id)
        }
      }
      // At least some topics should be paired
      expect(pairedCount).toBeGreaterThan(0)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════
// 11. Public save APIs: completeOnboarding
// ═══════════════════════════════════════════════════════════════════

describe('completeOnboarding with tier-split offerings', () => {
  it('normalizes tier selections — no legacy IDs persisted', () => {
    setupPendingMathsAqa()
    // Simulate onboarding finishing with a legacy ID in the caller array
    useAppStore.getState().completeOnboarding(
      ['maths-aqa', 'cs-aqa'],
      new Map()
    )
    const ids = useAppStore.getState().selectedOfferingIds
    // Legacy maths-aqa must not be persisted
    expect(ids).not.toContain('maths-aqa')
    // cs-aqa is not tier-split, should survive
    expect(ids).toContain('cs-aqa')
    // Should be onboarded
    expect(useAppStore.getState().onboarded).toBe(true)
  })

  it('routes pending tier subjects through confirmTierSelection', () => {
    setupPendingMathsAqa()
    // Caller sends maths-aqa-h + cs-aqa
    useAppStore.getState().completeOnboarding(
      ['maths-aqa-h', 'cs-aqa'],
      new Map()
    )
    const state = useAppStore.getState()
    expect(state.selectedOfferingIds).toContain('maths-aqa-h')
    expect(state.selectedOfferingIds).toContain('cs-aqa')
    // Pending should be cleared for maths
    expect(state.pendingTierConfirmations.has('maths')).toBe(false)
  })

  it('dismisses pending subjects not in the caller offering list', () => {
    setupPendingMathsAqa()
    // Caller doesn't include any maths offering — maths gets dismissed
    useAppStore.getState().completeOnboarding(
      ['cs-aqa'],
      new Map()
    )
    const state = useAppStore.getState()
    expect(state.pendingTierConfirmations.has('maths')).toBe(false)
    expect(state.selectedOfferingIds).not.toContain('maths-aqa-f')
    expect(state.selectedOfferingIds).not.toContain('maths-aqa-h')
    expect(state.selectedOfferingIds).toContain('cs-aqa')
  })

  it('ensures exactly one offering per tier-split subject after save', () => {
    setupPendingMathsAqa()
    // Caller sends BOTH F and H — normalization must keep only one
    useAppStore.getState().completeOnboarding(
      ['maths-aqa-f', 'maths-aqa-h'],
      new Map()
    )
    const ids = useAppStore.getState().selectedOfferingIds
    const mathsIds = ids.filter(id => id.startsWith('maths-aqa'))
    expect(mathsIds).toHaveLength(1)
  })

  it('applies confidence overrides to normalized offering topics', () => {
    setupPendingMathsAqa()
    const confMap = new Map([['maths-aqa-h', 4]])
    useAppStore.getState().completeOnboarding(
      ['maths-aqa-h'],
      confMap
    )
    const state = useAppStore.getState()
    // Topics for maths-aqa-h that had the confidence override should be updated
    const hTopics = state.topics.filter(t => t.offeringId === 'maths-aqa-h')
    for (const t of hTopics) {
      expect(t.confidence).toBe(4)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════
// 12. Public save APIs: updateSelectedOfferings
// ═══════════════════════════════════════════════════════════════════

describe('updateSelectedOfferings with tier-split offerings', () => {
  it('normalizes tier selections on save — no legacy IDs persisted', () => {
    setupPendingMathsAqa()
    useAppStore.getState().updateSelectedOfferings(
      ['maths-aqa', 'cs-aqa'],
      new Map()
    )
    const ids = useAppStore.getState().selectedOfferingIds
    expect(ids).not.toContain('maths-aqa')
    expect(ids).toContain('cs-aqa')
  })

  it('routes pending tier subjects through confirmTierSelection', () => {
    setupPendingMathsAqa()
    useAppStore.getState().updateSelectedOfferings(
      ['maths-aqa-h'],
      new Map()
    )
    const state = useAppStore.getState()
    expect(state.selectedOfferingIds).toContain('maths-aqa-h')
    expect(state.pendingTierConfirmations.has('maths')).toBe(false)
  })

  it('detects tier switch for already-confirmed subjects', () => {
    // Start with maths-aqa-f confirmed (no pending state)
    useAppStore.setState({
      ...useAppStore.getState(),
      selectedOfferingIds: ['maths-aqa-f', 'cs-aqa'],
      tierPairTopicMap: buildTestTierPairMap(),
    })
    // Add a session on a Foundation topic to test transfer
    const fTopic = seed.topics.find(t => t.offeringId === 'maths-aqa-f')!
    useAppStore.setState({
      ...useAppStore.getState(),
      sessions: [{
        id: 'sess-switch-1',
        topicId: fTopic.id,
        date: '2026-03-10',
        score: 0.8,
        timestamp: Date.now(),
      }],
    })
    // Caller switches to Higher
    useAppStore.getState().updateSelectedOfferings(
      ['maths-aqa-h', 'cs-aqa'],
      new Map()
    )
    const state = useAppStore.getState()
    expect(state.selectedOfferingIds).toContain('maths-aqa-h')
    expect(state.selectedOfferingIds).not.toContain('maths-aqa-f')
    // Session should have been cloned to Higher via switchTierSelection
    const pair = buildTestTierPairMap().get(fTopic.id)!
    const hSessions = state.sessions.filter(s => s.topicId === pair.pairTopicId)
    expect(hSessions.length).toBeGreaterThan(0)
  })

  it('ensures exactly one offering per tier-split subject', () => {
    useAppStore.setState({
      ...useAppStore.getState(),
      selectedOfferingIds: ['maths-aqa-f'],
      tierPairTopicMap: buildTestTierPairMap(),
    })
    // Caller sends both F and H — normalization keeps one
    useAppStore.getState().updateSelectedOfferings(
      ['maths-aqa-f', 'maths-aqa-h'],
      new Map()
    )
    const ids = useAppStore.getState().selectedOfferingIds
    const mathsIds = ids.filter(id => id.startsWith('maths-aqa'))
    expect(mathsIds).toHaveLength(1)
  })

  it('dismisses pending subjects not in new offering list', () => {
    setupPendingMathsAqa()
    useAppStore.getState().updateSelectedOfferings(
      ['cs-aqa'],
      new Map()
    )
    const state = useAppStore.getState()
    expect(state.pendingTierConfirmations.has('maths')).toBe(false)
    expect(state.selectedOfferingIds).not.toContain('maths-aqa-f')
    expect(state.selectedOfferingIds).not.toContain('maths-aqa-h')
  })
})

// ═══════════════════════════════════════════════════════════════════
// 13. autoFillPlan mirrors items for pending tier-split subjects
// ═══════════════════════════════════════════════════════════════════

describe('autoFillPlan with pending tier-split subjects', () => {
  it('mirrors plan items to both F and H for pending subjects', () => {
    setupPendingMathsAqa()
    const today = new Date('2026-03-15T12:00:00')
    useAppStore.getState().autoFillPlan(today)
    const state = useAppStore.getState()
    const plan = state.dailyPlan

    // Plan should have items — autoFill should produce at least some
    expect(plan.length).toBeGreaterThan(0)

    // For each plan item on a maths-aqa-f topic, there should be a mirrored maths-aqa-h item
    const tierMap = buildTestTierPairMap()
    const fItems = plan.filter(i => {
      const t = seed.topics.find(t => t.id === i.topicId)
      return t && t.offeringId === 'maths-aqa-f'
    })
    for (const fi of fItems) {
      const pair = tierMap.get(fi.topicId)
      if (!pair) continue
      const originId = getMigrationOriginId(fi.id)
      expect(originId).not.toBeNull()
      // Find the H mirror
      const hMirror = plan.find(i =>
        i.topicId === pair.pairTopicId &&
        getMigrationOriginId(i.id) === originId
      )
      expect(hMirror, `Missing H mirror for plan item on ${fi.topicId}`).toBeDefined()
    }
  })

  it('confirmed single-tier produces single-sided plan items only', () => {
    // Start with maths-aqa-h confirmed (no pending state)
    useAppStore.setState({
      ...useAppStore.getState(),
      selectedOfferingIds: ['maths-aqa-h'],
      tierPairTopicMap: buildTestTierPairMap(),
    })
    const today = new Date('2026-03-15T12:00:00')
    useAppStore.getState().autoFillPlan(today)
    const plan = useAppStore.getState().dailyPlan
    expect(plan.length).toBeGreaterThan(0)

    // No plan items should be on Foundation topics
    for (const item of plan) {
      const t = seed.topics.find(t => t.id === item.topicId)
      if (t) expect(t.offeringId).not.toBe('maths-aqa-f')
    }
  })

  it('after confirm, autoFillPlan produces only confirmed-tier items', () => {
    setupPendingMathsAqa()
    // Confirm Higher
    useAppStore.getState().confirmTierSelection('maths', 'maths-aqa-h')
    const today = new Date('2026-03-15T12:00:00')
    useAppStore.getState().autoFillPlan(today)
    const plan = useAppStore.getState().dailyPlan
    expect(plan.length).toBeGreaterThan(0)

    for (const item of plan) {
      const t = seed.topics.find(t => t.id === item.topicId)
      if (t) expect(t.offeringId).not.toBe('maths-aqa-f')
    }
    // All maths items should be on Higher
    const mathsItems = plan.filter(i => {
      const t = seed.topics.find(t => t.id === i.topicId)
      return t && (t.offeringId === 'maths-aqa-h' || t.offeringId === 'maths-aqa-f')
    })
    for (const item of mathsItems) {
      const t = seed.topics.find(t => t.id === item.topicId)!
      expect(t.offeringId).toBe('maths-aqa-h')
    }
  })
})

// ═══════════════════════════════════════════════════════════════════
// 14. Repeated switch via public API (idempotency)
// ═══════════════════════════════════════════════════════════════════

describe('repeated tier switch via updateSelectedOfferings', () => {
  function setupConfirmedFoundation() {
    const tierMap = buildTestTierPairMap()
    useAppStore.setState({
      ...useAppStore.getState(),
      selectedOfferingIds: ['maths-aqa-f', 'cs-aqa'],
      tierPairTopicMap: tierMap,
    })
    // Add a session and note on a Foundation topic
    const fTopic = seed.topics.find(t => t.offeringId === 'maths-aqa-f')!
    useAppStore.setState({
      ...useAppStore.getState(),
      sessions: [{
        id: 'sess-f-1',
        topicId: fTopic.id,
        date: '2026-03-10',
        score: 0.8,
        timestamp: Date.now(),
      }],
      notes: [{
        id: 'note-f-1',
        topicId: fTopic.id,
        date: '2026-03-10',
        text: 'Foundation note',
      }],
    })
    return fTopic
  }

  it('F→H→F→H produces exactly one tier offering and no duplicate records', () => {
    const fTopic = setupConfirmedFoundation()
    const tierMap = buildTestTierPairMap()
    const pair = tierMap.get(fTopic.id)!

    // Switch F → H
    useAppStore.getState().updateSelectedOfferings(['maths-aqa-h', 'cs-aqa'], new Map())
    let state = useAppStore.getState()
    expect(state.selectedOfferingIds).toContain('maths-aqa-h')
    expect(state.selectedOfferingIds).not.toContain('maths-aqa-f')
    const hSessionsAfterFirst = state.sessions.filter(s => s.topicId === pair.pairTopicId)

    // Switch H → F
    useAppStore.getState().updateSelectedOfferings(['maths-aqa-f', 'cs-aqa'], new Map())
    state = useAppStore.getState()
    expect(state.selectedOfferingIds).toContain('maths-aqa-f')
    expect(state.selectedOfferingIds).not.toContain('maths-aqa-h')

    // Switch F → H again
    useAppStore.getState().updateSelectedOfferings(['maths-aqa-h', 'cs-aqa'], new Map())
    state = useAppStore.getState()
    expect(state.selectedOfferingIds).toContain('maths-aqa-h')

    // Exactly one maths offering selected
    const mathsIds = state.selectedOfferingIds.filter(id =>
      id === 'maths-aqa-f' || id === 'maths-aqa-h' || id === 'maths-aqa'
    )
    expect(mathsIds).toHaveLength(1)

    // No duplicate sessions on Higher: same number as after first switch
    const hSessionsFinal = state.sessions.filter(s => s.topicId === pair.pairTopicId)
    expect(hSessionsFinal.length).toBe(hSessionsAfterFirst.length)
  })

  it('deselection of confirmed tier-split subject is non-destructive', () => {
    const fTopic = setupConfirmedFoundation()

    // Deselect maths entirely — only cs remains
    useAppStore.getState().updateSelectedOfferings(['cs-aqa'], new Map())
    const state = useAppStore.getState()
    expect(state.selectedOfferingIds).not.toContain('maths-aqa-f')
    expect(state.selectedOfferingIds).not.toContain('maths-aqa-h')

    // Sessions and notes are still in state (just unreachable)
    expect(state.sessions.some(s => s.topicId === fTopic.id)).toBe(true)
    expect(state.notes.some(n => n.topicId === fTopic.id)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════
// 15. Store-authoritative merge: tier actions not overwritten by caller
// ═══════════════════════════════════════════════════════════════════

describe('mergeTierAuthoritative behavior', () => {
  it('completeOnboarding does not overwrite confirmTierSelection result', () => {
    setupPendingMathsAqa()
    // Caller sends maths-aqa-h but also bio-aqa (legacy) + cs-aqa
    useAppStore.getState().completeOnboarding(
      ['maths-aqa-h', 'bio-aqa', 'cs-aqa'],
      new Map()
    )
    const ids = useAppStore.getState().selectedOfferingIds
    // maths-aqa-h should come from confirmTierSelection, preserved by merge
    expect(ids).toContain('maths-aqa-h')
    // bio-aqa is legacy — stripped
    expect(ids).not.toContain('bio-aqa')
    // cs-aqa is non-tier
    expect(ids).toContain('cs-aqa')
    // Only one maths offering
    expect(ids.filter(id => id.startsWith('maths-aqa')).length).toBe(1)
  })

  it('updateSelectedOfferings preserves switchTierSelection result', () => {
    useAppStore.setState({
      ...useAppStore.getState(),
      selectedOfferingIds: ['maths-aqa-f', 'cs-aqa'],
      tierPairTopicMap: buildTestTierPairMap(),
    })
    // Caller switches from F to H
    useAppStore.getState().updateSelectedOfferings(['maths-aqa-h', 'cs-aqa'], new Map())
    const ids = useAppStore.getState().selectedOfferingIds
    // switchTierSelection set maths-aqa-h, merge must not overwrite
    expect(ids).toContain('maths-aqa-h')
    expect(ids).not.toContain('maths-aqa-f')
    expect(ids).toContain('cs-aqa')
  })
})
