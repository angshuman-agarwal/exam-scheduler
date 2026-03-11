import {
  sanitizeSubjectInput,
  matchSubject,
  findSubjectCandidates,
} from './subject-matcher'
import type { SubjectMatchResult, SubjectCandidate } from './subject-matcher'

export { sanitizeSubjectInput, matchSubject, findSubjectCandidates }
export type { SubjectMatchResult, SubjectCandidate }

export interface SubjectTemplate {
  qualificationId: 'gcse' | 'alevel'
  subject: string
  boardId: 'aqa' | 'edexcel' | 'ocr' | 'wjec' | 'eduqas' | 'ccea'
  spec?: string
  papers?: { name: string; examDate?: string; examTime?: string }[]
  topics?: string[]
}

export function normalizeSubject(name: string): string {
  const result = matchSubject(name, 'strict')
  if (result.kind === 'exact' || result.kind === 'alias') return result.canonicalKey
  return sanitizeSubjectInput(name)
}

export function normalizeSpec(spec: string | undefined | null): string {
  return (spec ?? '').trim().toLowerCase()
}

/** Normalize a topic name for dedup matching. Locked behavior: lowercase + trim. */
export function normalizeTopic(name: string): string {
  return name.toLowerCase().trim()
}

export type NormalizedMatch = {
  id: string
  name: string
  matchKind: 'exact' | 'alias' | 'fuzzy' | 'fallback'
}

/**
 * Structured result from findNormalizedMatches.
 * Authoritative matches (exact/alias) are safe to auto-select.
 * Suggestions (fuzzy/fallback) must NEVER be auto-selected — always present
 * to the user for explicit confirmation.
 */
export type NormalizedMatchResult = {
  /** Registry-confirmed matches (exact or alias). Safe to auto-redirect on single match. */
  authoritative: NormalizedMatch[]
  /** Fuzzy or fallback matches. Must be shown as suggestions, never auto-applied. */
  suggestions: NormalizedMatch[]
}

export function findNormalizedMatches(
  name: string,
  subjects: { id: string; name: string }[],
  offerings: { id: string; subjectId: string; qualificationId: string }[],
  studyMode: 'gcse' | 'alevel',
  mode: 'strict' | 'interactive' = 'strict',
): NormalizedMatchResult {
  const result = matchSubject(name, mode)

  // Build target map: canonicalKey → matchKind
  const targets = new Map<string, 'exact' | 'alias' | 'fuzzy' | 'fallback'>()

  if (result.kind === 'exact') {
    targets.set(result.canonicalKey, 'exact')
  } else if (result.kind === 'alias') {
    targets.set(result.canonicalKey, 'alias')
  } else if (result.kind === 'fuzzy') {
    targets.set(result.canonicalKey, 'fuzzy')
  } else if (result.kind === 'ambiguous') {
    for (const c of result.candidates) {
      targets.set(c.canonicalKey, 'fuzzy')
    }
  } else {
    // none → sanitized fallback
    const sanitized = sanitizeSubjectInput(name)
    if (!sanitized) return { authoritative: [], suggestions: [] }
    targets.set(sanitized, 'fallback')
  }

  // Find subjects with ≥1 offering in studyMode
  const subjectsWithOfferings = new Set<string>()
  for (const o of offerings) {
    if (o.qualificationId === studyMode) subjectsWithOfferings.add(o.subjectId)
  }

  const authoritative: NormalizedMatch[] = []
  const suggestions: NormalizedMatch[] = []
  for (const s of subjects) {
    if (!subjectsWithOfferings.has(s.id)) continue
    const subjectKey = normalizeSubject(s.name)
    const matchKind = targets.get(subjectKey)
    if (matchKind) {
      const match = { id: s.id, name: s.name, matchKind }
      if (matchKind === 'exact' || matchKind === 'alias') {
        authoritative.push(match)
      } else {
        suggestions.push(match)
      }
    }
  }

  // Deterministic order: exact display-name match first, seeded before custom
  const exactLower = name.toLowerCase().trim()
  const sortFn = (a: NormalizedMatch, b: NormalizedMatch) => {
    const aExact = a.name.toLowerCase() === exactLower ? 0 : 1
    const bExact = b.name.toLowerCase() === exactLower ? 0 : 1
    if (aExact !== bExact) return aExact - bExact
    const aCustom = a.id.startsWith('custom-subject-') || a.id.startsWith('draft-') ? 1 : 0
    const bCustom = b.id.startsWith('custom-subject-') || b.id.startsWith('draft-') ? 1 : 0
    return aCustom - bCustom
  }
  authoritative.sort(sortFn)
  suggestions.sort(sortFn)

  return { authoritative, suggestions }
}

const TEMPLATES: SubjectTemplate[] = [
  {
    qualificationId: 'gcse',
    subject: 'history',
    boardId: 'aqa',
    spec: '8145',
    papers: [
      { name: 'Paper 1', examDate: '2026-05-18' },
      { name: 'Paper 2', examDate: '2026-06-05' },
    ],
    topics: [
      'Germany 1890\u20131945',
      'Conflict and tension 1894\u20131918',
      'Elizabethan England',
      'Norman England',
    ],
  },
  {
    qualificationId: 'gcse',
    subject: 'history',
    boardId: 'edexcel',
    spec: '1HI0',
    papers: [
      { name: 'Paper 1', examDate: '2026-06-01' },
      { name: 'Paper 2', examDate: '2026-06-08' },
      { name: 'Paper 3', examDate: '2026-06-15' },
    ],
    topics: [
      'Medicine in Britain',
      'Early Elizabethan England',
      'Weimar and Nazi Germany',
      'Superpower relations and the Cold War',
    ],
  },
  {
    qualificationId: 'gcse',
    subject: 'history',
    boardId: 'ocr',
    spec: 'J410',
    papers: [
      { name: 'Paper 1', examDate: '2026-06-02' },
      { name: 'Paper 2', examDate: '2026-06-09' },
    ],
    topics: [
      'The People\'s Health',
      'The Elizabethans',
      'History Around Us',
    ],
  },
  {
    qualificationId: 'gcse',
    subject: 'history',
    boardId: 'eduqas',
    spec: 'C100P',
    papers: [
      { name: 'Component 1', examDate: '2026-05-20' },
      { name: 'Component 2', examDate: '2026-06-04' },
    ],
    topics: [
      'Studies in depth',
      'Studies in breadth',
      'Thematic study',
    ],
  },
  {
    qualificationId: 'gcse',
    subject: 'history',
    boardId: 'wjec',
    spec: 'C100P',
    papers: [
      { name: 'Unit 1', examDate: '2026-05-20' },
      { name: 'Unit 2', examDate: '2026-06-04' },
    ],
    topics: [
      'Studies in depth',
      'Studies in breadth',
      'Thematic study',
    ],
  },
  {
    qualificationId: 'gcse',
    subject: 'psychology',
    boardId: 'aqa',
    spec: '8182',
    papers: [
      { name: 'Paper 1', examDate: '2026-06-09' },
      { name: 'Paper 2', examDate: '2026-06-16' },
    ],
    topics: [
      'Memory',
      'Perception',
      'Development',
      'Research methods',
      'Social influence',
      'Language, thought and communication',
      'Brain and neuropsychology',
      'Psychological problems',
    ],
  },
  {
    qualificationId: 'gcse',
    subject: 'art and design',
    boardId: 'aqa',
    spec: '8201',
    papers: [
      { name: 'Component 1 (Portfolio)' },
      { name: 'Component 2 (Externally set assignment)' },
    ],
    topics: [
      'Drawing and painting',
      'Printmaking',
      'Sculpture',
      'Photography',
      'Digital media',
      'Critical studies',
    ],
  },
]

type PresetBoardId = 'aqa' | 'edexcel' | 'ocr' | 'wjec' | 'eduqas' | 'ccea'

export function findTemplate(
  qualificationId: 'gcse' | 'alevel',
  subjectName: string,
  boardId: PresetBoardId,
): SubjectTemplate | null {
  const normalized = normalizeSubject(subjectName)
  return TEMPLATES.find(
    (t) =>
      t.qualificationId === qualificationId &&
      t.subject === normalized &&
      t.boardId === boardId,
  ) ?? null
}
