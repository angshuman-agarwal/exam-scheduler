import { describe, it, expect } from 'vitest'
import { sanitizeSubjectInput, matchSubject, levenshtein, resolveFuzzyCandidates } from '../subject-matcher'
import { normalizeSubject, findTemplate } from '../templates'
import seedData from '../subjects.json'

// Legacy ALIAS_MAP snapshot — exhaustive regression fixture
const LEGACY_ALIASES: Record<string, string> = {
  'psychology': 'psychology',
  'psych': 'psychology',
  'art': 'art and design',
  'art & design': 'art and design',
  'art and design': 'art and design',
  'maths': 'mathematics',
  'math': 'mathematics',
  'mathematics': 'mathematics',
  'rs': 'religious studies',
  're': 'religious studies',
  'religious education': 'religious studies',
  'religious studies': 'religious studies',
  'dt': 'design and technology',
  'd&t': 'design and technology',
  'd and t': 'design and technology',
  'design and technology': 'design and technology',
  'comp sci': 'computer science',
  'cs': 'computer science',
  'computing': 'computer science',
  'computer science': 'computer science',
  'pe': 'physical education',
  'phys ed': 'physical education',
  'physical education': 'physical education',
  'history': 'history',
  'biology': 'biology',
  'bio': 'biology',
  'chemistry': 'chemistry',
  'chem': 'chemistry',
  'physics': 'physics',
  'phys': 'physics',
  'geography': 'geography',
  'geog': 'geography',
  'geo': 'geography',
  'english literature': 'english literature',
  'eng lit': 'english literature',
  'english language': 'english language',
  'eng lang': 'english language',
  'french': 'french',
  'further mathematics': 'further mathematics',
  'further maths': 'further mathematics',
  'fm': 'further mathematics',
}

describe('sanitizeSubjectInput', () => {
  it('trims and lowercases', () => {
    expect(sanitizeSubjectInput('  Biology  ')).toBe('biology')
  })

  it('strips board suffix in parens', () => {
    expect(sanitizeSubjectInput('Maths (OCR)')).toBe('maths')
  })

  it('strips board suffix with dash', () => {
    expect(sanitizeSubjectInput('Maths - AQA')).toBe('maths')
  })

  it('normalizes & to and', () => {
    expect(sanitizeSubjectInput('Art & Design')).toBe('art and design')
  })

  it('normalizes & without spaces', () => {
    expect(sanitizeSubjectInput('D&T')).toBe('d and t')
  })

  it('strips dots', () => {
    expect(sanitizeSubjectInput('R.S.')).toBe('rs')
  })

  it('collapses whitespace', () => {
    expect(sanitizeSubjectInput('  comp   sci  ')).toBe('comp sci')
  })
})

describe('matchSubject (strict)', () => {
  it('exact canonical: biology', () => {
    const r = matchSubject('biology', 'strict')
    expect(r.kind).toBe('exact')
    if (r.kind === 'exact') expect(r.canonicalKey).toBe('biology')
  })

  it('exact alias: bio', () => {
    const r = matchSubject('bio', 'strict')
    expect(r.kind).toBe('alias')
    if (r.kind === 'alias') expect(r.canonicalKey).toBe('biology')
  })

  it('abbreviation: eng lit', () => {
    const r = matchSubject('eng lit', 'strict')
    expect(r.kind).toBe('alias')
    if (r.kind === 'alias') expect(r.canonicalKey).toBe('english literature')
  })

  it('punctuation via sanitize: R.S.', () => {
    const r = matchSubject('R.S.', 'strict')
    expect(r.kind).toBe('alias')
    if (r.kind === 'alias') expect(r.canonicalKey).toBe('religious studies')
  })

  it('board stripping: Maths (OCR)', () => {
    const r = matchSubject('Maths (OCR)', 'strict')
    expect(r.kind).toBe('alias')
    if (r.kind === 'alias') expect(r.canonicalKey).toBe('mathematics')
  })

  it('& normalization: art & design', () => {
    const r = matchSubject('art & design', 'strict')
    expect(r.kind).toBe('exact')
    if (r.kind === 'exact') expect(r.canonicalKey).toBe('art and design')
  })

  it('d&t → design and technology', () => {
    const r = matchSubject('d&t', 'strict')
    expect(r.kind).toBe('alias')
    if (r.kind === 'alias') expect(r.canonicalKey).toBe('design and technology')
  })

  it('unknown: sociology', () => {
    expect(matchSubject('sociology', 'strict').kind).toBe('none')
  })

  it('no prefix matching: biolo', () => {
    expect(matchSubject('biolo', 'strict').kind).toBe('none')
  })
})

describe('matchSubject (interactive)', () => {
  it('typo: bilogy → fuzzy biology', () => {
    const r = matchSubject('bilogy', 'interactive')
    expect(r.kind).toBe('fuzzy')
    if (r.kind === 'fuzzy') {
      expect(r.canonicalKey).toBe('biology')
      expect(r.distance).toBe(1)
    }
  })

  it('short input alias: bio → alias not fuzzy', () => {
    const r = matchSubject('bio', 'interactive')
    expect(r.kind).toBe('alias')
  })

  it('short unknown no fuzzy: bi → none (< 4 chars)', () => {
    expect(matchSubject('bi', 'interactive').kind).toBe('none')
  })

  it('typo: mathmatics → fuzzy mathematics', () => {
    const r = matchSubject('mathmatics', 'interactive')
    expect(r.kind).toBe('fuzzy')
    if (r.kind === 'fuzzy') expect(r.canonicalKey).toBe('mathematics')
  })

  it('strict mode rejects fuzzy: bilogy', () => {
    expect(matchSubject('bilogy', 'strict').kind).toBe('none')
  })

  it('single winner within threshold: histor → fuzzy history', () => {
    const r = matchSubject('histor', 'interactive')
    expect(r.kind).toBe('fuzzy')
    if (r.kind === 'fuzzy') expect(r.canonicalKey).toBe('history')
  })
})

describe('levenshtein', () => {
  it('identical strings → 0', () => {
    expect(levenshtein('biology', 'biology')).toBe(0)
  })

  it('single substitution', () => {
    expect(levenshtein('bilogy', 'biology')).toBe(1)
  })

  it('single deletion', () => {
    expect(levenshtein('histor', 'history')).toBe(1)
  })

  it('single insertion', () => {
    expect(levenshtein('biologyy', 'biology')).toBe(1)
  })

  it('transposition counts as 2', () => {
    expect(levenshtein('physcs', 'physics')).toBe(1) // deletion of i
    expect(levenshtein('physcis', 'physics')).toBe(2) // sc→cs transposition = 2 ops
  })

  it('empty strings', () => {
    expect(levenshtein('', '')).toBe(0)
    expect(levenshtein('abc', '')).toBe(3)
    expect(levenshtein('', 'abc')).toBe(3)
  })
})

describe('resolveFuzzyCandidates', () => {
  it('empty candidates → none', () => {
    expect(resolveFuzzyCandidates([]).kind).toBe('none')
  })

  it('single candidate → fuzzy', () => {
    const r = resolveFuzzyCandidates([
      { canonicalKey: 'biology', displayName: 'Biology', distance: 1 },
    ])
    expect(r.kind).toBe('fuzzy')
    if (r.kind === 'fuzzy') {
      expect(r.canonicalKey).toBe('biology')
      expect(r.distance).toBe(1)
    }
  })

  it('clear winner with gap ≥ 1 → fuzzy', () => {
    const r = resolveFuzzyCandidates([
      { canonicalKey: 'biology', displayName: 'Biology', distance: 1 },
      { canonicalKey: 'geology', displayName: 'Geology', distance: 2 },
    ])
    expect(r.kind).toBe('fuzzy')
    if (r.kind === 'fuzzy') expect(r.canonicalKey).toBe('biology')
  })

  it('tied best distances → ambiguous', () => {
    const r = resolveFuzzyCandidates([
      { canonicalKey: 'biology', displayName: 'Biology', distance: 1 },
      { canonicalKey: 'theology', displayName: 'Theology', distance: 1 },
    ])
    expect(r.kind).toBe('ambiguous')
    if (r.kind === 'ambiguous') {
      expect(r.candidates).toHaveLength(2)
      const keys = r.candidates.map(c => c.canonicalKey).sort()
      expect(keys).toEqual(['biology', 'theology'])
    }
  })

  it('three-way tie → ambiguous with all three', () => {
    const r = resolveFuzzyCandidates([
      { canonicalKey: 'a', displayName: 'A', distance: 2 },
      { canonicalKey: 'b', displayName: 'B', distance: 2 },
      { canonicalKey: 'c', displayName: 'C', distance: 2 },
    ])
    expect(r.kind).toBe('ambiguous')
    if (r.kind === 'ambiguous') {
      expect(r.candidates).toHaveLength(3)
    }
  })

  it('tie at best with distant third → ambiguous (only tied pair)', () => {
    const r = resolveFuzzyCandidates([
      { canonicalKey: 'biology', displayName: 'Biology', distance: 1 },
      { canonicalKey: 'theology', displayName: 'Theology', distance: 1 },
      { canonicalKey: 'zoology', displayName: 'Zoology', distance: 2 },
    ])
    expect(r.kind).toBe('ambiguous')
    if (r.kind === 'ambiguous') {
      expect(r.candidates).toHaveLength(2)
    }
  })

  it('unsorted input is handled correctly', () => {
    const r = resolveFuzzyCandidates([
      { canonicalKey: 'geology', displayName: 'Geology', distance: 2 },
      { canonicalKey: 'biology', displayName: 'Biology', distance: 1 },
    ])
    expect(r.kind).toBe('fuzzy')
    if (r.kind === 'fuzzy') expect(r.canonicalKey).toBe('biology')
  })
})

describe('normalizeSubject shim', () => {
  it('biology → biology', () => {
    expect(normalizeSubject('biology')).toBe('biology')
  })

  it('bio → biology', () => {
    expect(normalizeSubject('bio')).toBe('biology')
  })

  it('R.S. → religious studies (improvement over old r.s.)', () => {
    expect(normalizeSubject('R.S.')).toBe('religious studies')
  })

  it('sociology → sociology (sanitized passthrough)', () => {
    expect(normalizeSubject('sociology')).toBe('sociology')
  })

  it('biolo → biolo (no prefix matching)', () => {
    expect(normalizeSubject('biolo')).toBe('biolo')
  })
})

describe('Regression: legacy ALIAS_MAP', () => {
  for (const [key, expected] of Object.entries(LEGACY_ALIASES)) {
    it(`normalizeSubject("${key}") === "${expected}"`, () => {
      expect(normalizeSubject(key)).toBe(expected)
    })
  }
})

describe('Regression: seeded subjects.json names', () => {
  // Every seeded subject name must resolve to a known canonical key (not passthrough)
  const SEEDED_EXPECTATIONS: Record<string, string> = {
    'Computer Science': 'computer science',
    'English Literature': 'english literature',
    'Biology': 'biology',
    'R.S.': 'religious studies',
    'Geography': 'geography',
    'Maths': 'mathematics',
    'Chemistry': 'chemistry',
    'English Language': 'english language',
    'Physics': 'physics',
    'Music': 'music',
    'Spanish': 'spanish',
    'Additional Maths': 'additional mathematics',
    'History': 'history',
    'French': 'french',
    'Further Mathematics': 'further mathematics',
  }

  // Verify fixture matches actual seed data
  it('fixture covers all seeded subjects', () => {
    const seededNames = seedData.subjects.map(s => s.name)
    expect(seededNames.sort()).toEqual(Object.keys(SEEDED_EXPECTATIONS).sort())
  })

  for (const [name, expectedKey] of Object.entries(SEEDED_EXPECTATIONS)) {
    it(`"${name}" → "${expectedKey}"`, () => {
      expect(normalizeSubject(name)).toBe(expectedKey)
    })
  }

  // Verify each seeded name produces a registry match (not passthrough)
  for (const s of seedData.subjects) {
    it(`"${s.name}" matches registry (not passthrough)`, () => {
      const result = matchSubject(s.name, 'strict')
      expect(result.kind).not.toBe('none')
    })
  }
})

describe('findTemplate: typo protection', () => {
  it('typo input does not template-resolve (strict mode)', () => {
    // "bilogy" should NOT find a template — user must confirm fuzzy suggestion first
    expect(findTemplate('gcse', 'bilogy', 'aqa')).toBeNull()
  })

  it('partial input does not template-resolve', () => {
    expect(findTemplate('gcse', 'histor', 'aqa')).toBeNull()
  })

  it('valid alias still template-resolves', () => {
    expect(findTemplate('gcse', 'psych', 'aqa')).not.toBeNull()
  })
})
