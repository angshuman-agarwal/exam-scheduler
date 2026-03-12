import { describe, it, expect } from 'vitest'
import seedData from '../subjects.json'
import { TIER_SPLIT_MAP, PAPER_SPLIT_MAP } from '../../stores/app.store'

describe('Seed data integrity', () => {
  it('all offering IDs are unique', () => {
    const ids = seedData.offerings.map(o => o.id)
    expect(ids.length).toBe(new Set(ids).size)
  })

  it('all paper IDs are unique', () => {
    const ids = seedData.papers.map(p => p.id)
    expect(ids.length).toBe(new Set(ids).size)
  })

  it('all topic IDs are unique', () => {
    const ids = seedData.topics.map(t => t.id)
    expect(ids.length).toBe(new Set(ids).size)
  })

  it('all offerings reference valid subjects', () => {
    const subjectIds = new Set(seedData.subjects.map(s => s.id))
    for (const o of seedData.offerings) {
      expect(subjectIds.has(o.subjectId), `Offering ${o.id} references missing subject ${o.subjectId}`).toBe(true)
    }
  })

  it('all papers reference valid offerings', () => {
    const offeringIds = new Set(seedData.offerings.map(o => o.id))
    for (const p of seedData.papers) {
      expect(offeringIds.has(p.offeringId), `Paper ${p.id} references missing offering ${p.offeringId}`).toBe(true)
    }
  })

  it('all topics reference valid papers and offerings', () => {
    const paperIds = new Set(seedData.papers.map(p => p.id))
    const offeringIds = new Set(seedData.offerings.map(o => o.id))
    for (const t of seedData.topics) {
      expect(paperIds.has(t.paperId), `Topic ${t.id} references missing paper ${t.paperId}`).toBe(true)
      expect(offeringIds.has(t.offeringId), `Topic ${t.id} references missing offering ${t.offeringId}`).toBe(true)
    }
  })
})

describe('TIER_SPLIT_MAP targets exist in seed', () => {
  const offeringIds = new Set(seedData.offerings.map(o => o.id))

  for (const [legacyId, [fId, hId]] of Object.entries(TIER_SPLIT_MAP)) {
    it(`${legacyId} → [${fId}, ${hId}] targets exist`, () => {
      expect(offeringIds.has(fId), `Foundation offering ${fId} missing from seed`).toBe(true)
      expect(offeringIds.has(hId), `Higher offering ${hId} missing from seed`).toBe(true)
    })

    it(`${legacyId} is NOT in seed (removed)`, () => {
      expect(offeringIds.has(legacyId), `Legacy offering ${legacyId} should not be in seed`).toBe(false)
    })
  }
})

describe('PAPER_SPLIT_MAP targets exist in seed', () => {
  const paperIds = new Set(seedData.papers.map(p => p.id))

  for (const [oldPaperId, [fPaperId, hPaperId]] of Object.entries(PAPER_SPLIT_MAP)) {
    it(`${oldPaperId} → [${fPaperId}, ${hPaperId}] targets exist`, () => {
      expect(paperIds.has(fPaperId), `Foundation paper ${fPaperId} missing from seed`).toBe(true)
      expect(paperIds.has(hPaperId), `Higher paper ${hPaperId} missing from seed`).toBe(true)
    })

    it(`${oldPaperId} is NOT in seed (removed)`, () => {
      expect(paperIds.has(oldPaperId), `Legacy paper ${oldPaperId} should not be in seed`).toBe(false)
    })
  }
})

describe('Tiered offerings come in F/H pairs', () => {
  for (const [, [fId, hId]] of Object.entries(TIER_SPLIT_MAP)) {
    const fOff = seedData.offerings.find(o => o.id === fId)
    const hOff = seedData.offerings.find(o => o.id === hId)

    it(`${fId} and ${hId} share same subject and board`, () => {
      expect(fOff).toBeDefined()
      expect(hOff).toBeDefined()
      expect(fOff!.subjectId).toBe(hOff!.subjectId)
      expect(fOff!.boardId).toBe(hOff!.boardId)
      expect(fOff!.spec).toBe(hOff!.spec)
    })

    it(`${fId} label contains "Foundation"`, () => {
      expect(fOff!.label).toContain('Foundation')
    })

    it(`${hId} label contains "Higher"`, () => {
      expect(hOff!.label).toContain('Higher')
    })
  }
})
