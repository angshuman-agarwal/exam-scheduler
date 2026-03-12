// ── Types ──

export type SubjectCandidate = {
  canonicalKey: string
  displayName: string
  distance?: number
}

export type SubjectMatchResult =
  | { kind: 'exact'; canonicalKey: string; displayName: string }
  | { kind: 'alias'; canonicalKey: string; displayName: string }
  | { kind: 'fuzzy'; canonicalKey: string; displayName: string; distance: number }
  | { kind: 'ambiguous'; candidates: SubjectCandidate[] }
  | { kind: 'none' }

// ── Registry ──

interface RegistryEntry {
  canonicalKey: string
  displayName: string
  aliases: string[]
  abbreviations: string[]
}

const REGISTRY: RegistryEntry[] = [
  {
    canonicalKey: 'psychology',
    displayName: 'Psychology',
    aliases: [],
    abbreviations: ['psych'],
  },
  {
    canonicalKey: 'art and design',
    displayName: 'Art and Design',
    aliases: [],
    abbreviations: ['art'],
  },
  {
    canonicalKey: 'mathematics',
    displayName: 'Mathematics',
    aliases: ['maths'],
    abbreviations: ['math'],
  },
  {
    canonicalKey: 'additional mathematics',
    displayName: 'Additional Maths',
    aliases: ['additional maths', 'add maths'],
    abbreviations: [],
  },
  {
    canonicalKey: 'religious studies',
    displayName: 'Religious Studies',
    aliases: ['religious education'],
    abbreviations: ['rs', 're'],
  },
  {
    canonicalKey: 'design and technology',
    displayName: 'Design and Technology',
    aliases: ['d and t'],
    abbreviations: ['dt'],
  },
  {
    canonicalKey: 'computer science',
    displayName: 'Computer Science',
    aliases: ['computing'],
    abbreviations: ['comp sci', 'comp sc', 'cs'],
  },
  {
    canonicalKey: 'physical education',
    displayName: 'Physical Education',
    aliases: ['phys ed'],
    abbreviations: ['pe'],
  },
  {
    canonicalKey: 'history',
    displayName: 'History',
    aliases: [],
    abbreviations: [],
  },
  {
    canonicalKey: 'biology',
    displayName: 'Biology',
    aliases: [],
    abbreviations: ['bio'],
  },
  {
    canonicalKey: 'chemistry',
    displayName: 'Chemistry',
    aliases: [],
    abbreviations: ['chem'],
  },
  {
    canonicalKey: 'physics',
    displayName: 'Physics',
    aliases: [],
    abbreviations: ['phys'],
  },
  {
    canonicalKey: 'geography',
    displayName: 'Geography',
    aliases: [],
    abbreviations: ['geog', 'geo'],
  },
  {
    canonicalKey: 'english literature',
    displayName: 'English Literature',
    aliases: [],
    abbreviations: ['eng lit'],
  },
  {
    canonicalKey: 'english language',
    displayName: 'English Language',
    aliases: [],
    abbreviations: ['eng lang'],
  },
  {
    canonicalKey: 'music',
    displayName: 'Music',
    aliases: [],
    abbreviations: [],
  },
  {
    canonicalKey: 'spanish',
    displayName: 'Spanish',
    aliases: [],
    abbreviations: [],
  },
  {
    canonicalKey: 'french',
    displayName: 'French',
    aliases: [],
    abbreviations: [],
  },
  {
    canonicalKey: 'further mathematics',
    displayName: 'Further Mathematics',
    aliases: ['further maths'],
    abbreviations: ['fm'],
  },
]

// ── Indices (built once at module load) ──

const canonicalIndex = new Map<string, RegistryEntry>()
const aliasIndex = new Map<string, RegistryEntry>()

for (const entry of REGISTRY) {
  canonicalIndex.set(entry.canonicalKey, entry)
  for (const alias of entry.aliases) {
    aliasIndex.set(alias, entry)
  }
  for (const abbrev of entry.abbreviations) {
    aliasIndex.set(abbrev, entry)
  }
}

// ── Sanitizer ──

const BOARD_SUFFIX_RE = /\s*[(-]\s*(aqa|ocr|edexcel|wjec|eduqas|ccea)[)\s]*$/i
const BOARD_TRAILING_RE = /\s+(aqa|ocr|edexcel|wjec|eduqas|ccea)$/i

export function sanitizeSubjectInput(input: string): string {
  let s = input.toLowerCase().trim()
  // Strip board suffixes
  s = s.replace(BOARD_SUFFIX_RE, '').trim()
  s = s.replace(BOARD_TRAILING_RE, '').trim()
  // & → and (with space normalization)
  s = s.replace(/\s*&\s*/g, ' and ')
  // Strip dots
  s = s.replace(/\./g, '')
  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

// ── Levenshtein ──

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    prev = curr
  }
  return prev[b.length]
}

// ── Fuzzy decision logic ──

/**
 * Given fuzzy candidates (sorted by distance), apply the acceptance policy:
 * - Single best with runner-up gap ≥ 1 → fuzzy winner
 * - Tied best distances → ambiguous
 * - Otherwise → none
 *
 * Exported for direct testing — the ambiguous branch is unreachable with the
 * current registry (all canonical keys have pairwise edit distance > 4) but
 * must be covered for correctness as the registry grows.
 */
export function resolveFuzzyCandidates(
  candidates: { canonicalKey: string; displayName: string; distance: number }[],
): SubjectMatchResult {
  if (candidates.length === 0) return { kind: 'none' }

  const sorted = [...candidates].sort((a, b) => a.distance - b.distance)
  const best = sorted[0].distance
  const bests = sorted.filter(c => c.distance === best)

  if (bests.length === 1) {
    const runnerUp = sorted.length > 1 ? sorted[1].distance : Infinity
    if (runnerUp - best >= 1) {
      return { kind: 'fuzzy', canonicalKey: bests[0].canonicalKey, displayName: bests[0].displayName, distance: best }
    }
  }

  // Tied best distances → ambiguous
  if (bests.length > 1) {
    return { kind: 'ambiguous', candidates: bests }
  }

  return { kind: 'none' }
}

// ── Matcher ──

export function matchSubject(
  input: string,
  mode: 'strict' | 'interactive' = 'strict',
): SubjectMatchResult {
  const sanitized = sanitizeSubjectInput(input)
  if (!sanitized) return { kind: 'none' }

  // Tier 1: exact canonical key
  const exactEntry = canonicalIndex.get(sanitized)
  if (exactEntry) {
    return { kind: 'exact', canonicalKey: exactEntry.canonicalKey, displayName: exactEntry.displayName }
  }

  // Tier 2: alias/abbreviation
  const aliasEntry = aliasIndex.get(sanitized)
  if (aliasEntry) {
    return { kind: 'alias', canonicalKey: aliasEntry.canonicalKey, displayName: aliasEntry.displayName }
  }

  // Tier 3: fuzzy (interactive only, input ≥ 4 chars)
  if (mode === 'interactive' && sanitized.length >= 4) {
    const maxDist = Math.min(2, Math.floor(sanitized.length / 3))
    const candidates: { canonicalKey: string; displayName: string; distance: number }[] = []

    for (const entry of REGISTRY) {
      const dist = levenshtein(sanitized, entry.canonicalKey)
      if (dist <= maxDist) {
        candidates.push({ canonicalKey: entry.canonicalKey, displayName: entry.displayName, distance: dist })
      }
    }

    return resolveFuzzyCandidates(candidates)
  }

  return { kind: 'none' }
}

// ── Convenience wrapper ──

export function findSubjectCandidates(
  input: string,
  mode: 'strict' | 'interactive' = 'strict',
): SubjectCandidate[] {
  const result = matchSubject(input, mode)
  switch (result.kind) {
    case 'exact':
    case 'alias':
      return [{ canonicalKey: result.canonicalKey, displayName: result.displayName }]
    case 'fuzzy':
      return [{ canonicalKey: result.canonicalKey, displayName: result.displayName, distance: result.distance }]
    case 'ambiguous':
      return result.candidates
    case 'none':
      return []
  }
}
