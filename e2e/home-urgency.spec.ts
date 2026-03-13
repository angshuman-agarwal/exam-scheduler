import { test, expect } from '@playwright/test'
import seedData from '../src/data/subjects.json' with { type: 'json' }
import { SEED_REVISION } from '../src/lib/constants.ts'
import type { PersistedState } from './helpers/seedAppState'

const FROZEN_DATE = '2026-04-15'

function homeState(daysUntilExam: number): PersistedState {
  const frozen = new Date(FROZEN_DATE + 'T00:00:00')
  const examDate = new Date(frozen.getTime() + daysUntilExam * 86_400_000)
  const examDateStr = examDate.toISOString().slice(0, 10)

  const papers = JSON.parse(JSON.stringify(seedData.papers)) as typeof seedData.papers
  // Override cs-aqa paper 1 exam date
  const p = papers.find((p) => p.id === 'cs-p1')!
  p.examDate = examDateStr

  return {
    version: 2,
    seedRevision: SEED_REVISION,
    boards: JSON.parse(JSON.stringify(seedData.boards)),
    subjects: JSON.parse(JSON.stringify(seedData.subjects)),
    offerings: JSON.parse(JSON.stringify(seedData.offerings)),
    papers,
    topics: JSON.parse(JSON.stringify(seedData.topics)),
    sessions: [],
    notes: [],
    userState: { energyLevel: 3, stress: 2 },
    onboarded: true,
    selectedOfferingIds: ['cs-aqa'],
    dailyPlan: [],
    planDay: '',
  }
}

async function openHome(page: import('@playwright/test').Page, state: PersistedState) {
  await page.addInitScript((dateStr: string) => {
    const frozen = new Date(dateStr + 'T12:00:00').getTime()
    const OrigDate = Date
    const FakeDate = function (this: Date, ...args: unknown[]) {
      if (args.length === 0) return new OrigDate(frozen)
      // @ts-expect-error — spread into Date constructor
      return new OrigDate(...args)
    } as unknown as DateConstructor
    FakeDate.prototype = OrigDate.prototype
    FakeDate.now = () => frozen
    FakeDate.parse = OrigDate.parse
    FakeDate.UTC = OrigDate.UTC
    // @ts-expect-error — override global Date
    globalThis.Date = FakeDate
  }, FROZEN_DATE)

  await page.goto('/')

  await page.evaluate(async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    localStorage.clear()
    sessionStorage.clear()
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('gcse-scheduler', 2)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('state')) db.createObjectStore('state')
      }
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('state', 'readwrite')
        tx.objectStore('state').clear()
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
      }
      req.onerror = () => reject(req.error)
    })
  })

  await page.evaluate(async (s: PersistedState) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('gcse-scheduler', 2)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('state', 'readwrite')
        tx.objectStore('state').put(s, 'app')
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
      }
      req.onerror = () => reject(req.error)
    })
  }, state)

  await page.reload()
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })
}

test('60 days away shows On track', async ({ page }) => {
  await openHome(page, homeState(60))

  const chip = page.getByTestId('home-urgency-chip')
  await expect(chip).toBeVisible()
  await expect(chip).toHaveText('On track')
  await expect(chip).not.toHaveText('Getting close')
})

test('29 days away shows Getting close', async ({ page }) => {
  await openHome(page, homeState(29))

  const chip = page.getByTestId('home-urgency-chip')
  await expect(chip).toBeVisible()
  await expect(chip).toHaveText('Getting close')
})
