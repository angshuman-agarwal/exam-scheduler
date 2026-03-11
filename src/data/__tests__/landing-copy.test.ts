import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import copy from '../landing-copy.json'

const __dir = dirname(fileURLToPath(import.meta.url))
const publicDir = resolve(__dir, '../../../public')

describe('landing-copy.json schema', () => {
  it('has all required meta fields', () => {
    const required = [
      'title', 'description', 'canonicalUrl',
      'ogTitle', 'ogDescription',
      'twitterTitle', 'twitterDescription', 'twitterSite',
    ] as const
    for (const key of required) {
      expect(copy.meta[key], `meta.${key}`).toBeTruthy()
      expect(typeof copy.meta[key]).toBe('string')
    }
  })

  it('has all section headings', () => {
    const required = ['howItWorks', 'howItWorksSubtitle', 'scenarios', 'trust'] as const
    for (const key of required) {
      expect(copy.sectionHeadings[key], `sectionHeadings.${key}`).toBeTruthy()
      expect(typeof copy.sectionHeadings[key]).toBe('string')
    }
  })

  it('has hero copy', () => {
    expect(copy.hero.tagline).toBeTruthy()
    expect(copy.hero.headline).toBeTruthy()
    expect(copy.hero.subheadline).toBeTruthy()
  })

  it('has at least one step with required fields', () => {
    expect(copy.steps.length).toBeGreaterThanOrEqual(1)
    for (const s of copy.steps) {
      expect(typeof s.step).toBe('number')
      expect(s.title).toBeTruthy()
      expect(s.description).toBeTruthy()
    }
  })

  it('has at least one scenario with required fields', () => {
    expect(copy.scenarios.length).toBeGreaterThanOrEqual(1)
    for (const s of copy.scenarios) {
      expect(s.situation).toBeTruthy()
      expect(s.response).toBeTruthy()
    }
  })

  it('has at least one trust feature with required fields', () => {
    expect(copy.trustFeatures.length).toBeGreaterThanOrEqual(1)
    for (const f of copy.trustFeatures) {
      expect(f.title).toBeTruthy()
      expect(f.description).toBeTruthy()
    }
  })

  it('canonical URL is a valid HTTPS URL', () => {
    expect(copy.meta.canonicalUrl).toMatch(/^https:\/\//)
  })

  it('ogImage references an existing asset or valid URL if set', () => {
    const meta = copy.meta as Record<string, string>
    if (!meta.ogImage) return
    if (/^https?:\/\//.test(meta.ogImage)) {
      // Absolute URL — must reference the same origin to be verifiable at build time.
      // If it's a relative path on the canonical origin, check public/.
      const canonical = new URL(copy.meta.canonicalUrl)
      try {
        const imgUrl = new URL(meta.ogImage)
        if (imgUrl.origin === canonical.origin) {
          expect(existsSync(resolve(publicDir, imgUrl.pathname.slice(1))),
            `ogImage asset missing: public${imgUrl.pathname}`).toBe(true)
        }
        // External URL — can't verify at build time, accept it.
      } catch {
        expect.fail(`ogImage is not a valid URL: ${meta.ogImage}`)
      }
    } else {
      // Relative path — must exist in public/
      expect(existsSync(resolve(publicDir, meta.ogImage.replace(/^\//, ''))),
        `ogImage asset missing: public/${meta.ogImage}`).toBe(true)
    }
  })

  it('twitterImage references an existing asset or valid URL if set', () => {
    const meta = copy.meta as Record<string, string>
    if (!meta.twitterImage) return
    if (/^https?:\/\//.test(meta.twitterImage)) {
      const canonical = new URL(copy.meta.canonicalUrl)
      try {
        const imgUrl = new URL(meta.twitterImage)
        if (imgUrl.origin === canonical.origin) {
          expect(existsSync(resolve(publicDir, imgUrl.pathname.slice(1))),
            `twitterImage asset missing: public${imgUrl.pathname}`).toBe(true)
        }
      } catch {
        expect.fail(`twitterImage is not a valid URL: ${meta.twitterImage}`)
      }
    } else {
      expect(existsSync(resolve(publicDir, meta.twitterImage.replace(/^\//, ''))),
        `twitterImage asset missing: public/${meta.twitterImage}`).toBe(true)
    }
  })
})
