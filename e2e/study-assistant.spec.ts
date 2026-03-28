import { expect, test, type Page } from '@playwright/test'
import seedData from '../src/data/subjects.json' with { type: 'json' }
import { SEED_REVISION } from '../src/lib/constants.ts'
import type { PersistedState } from './helpers/seedAppState'

const FROZEN_DATE = '2026-04-15'

function onboardedState(): PersistedState {
  return {
    version: 2,
    seedRevision: SEED_REVISION,
    boards: JSON.parse(JSON.stringify(seedData.boards)),
    subjects: JSON.parse(JSON.stringify(seedData.subjects)),
    offerings: JSON.parse(JSON.stringify(seedData.offerings)),
    papers: JSON.parse(JSON.stringify(seedData.papers)),
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

async function openToday(page: Page, state: PersistedState) {
  await page.addInitScript((dateStr: string) => {
    const frozen = new Date(dateStr + 'T12:00:00').getTime()
    const OrigDate = Date
    const FakeDate = function (this: Date, ...args: unknown[]) {
      if (args.length === 0) return new OrigDate(frozen)
      // @ts-expect-error constructor passthrough
      return new OrigDate(...args)
    } as unknown as DateConstructor
    FakeDate.prototype = OrigDate.prototype
    FakeDate.now = () => frozen
    FakeDate.parse = OrigDate.parse
    FakeDate.UTC = OrigDate.UTC
    // @ts-expect-error override global Date for app boot
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

  await page.goto('/#today')
  await page.reload()
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })
}

test('study assistant launcher opens and closes the help panel', async ({ page }) => {
  await openToday(page, onboardedState())

  const launcher = page.getByTestId('study-assistant-launcher')
  await expect(launcher).toBeVisible()

  await launcher.click()

  const panel = page.getByTestId('study-assistant-panel')
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Study Assistant')
  await expect(panel).toContainText('Hi. I’m here for both planner guidance and tutor help.')
  await expect(page.getByTestId('study-assistant-input')).toHaveAttribute('placeholder', 'Ask about your plan or subjects...')
  await expect(page.getByTestId('study-assistant-suggestion-primary')).toBeVisible()
  await expect(panel).toContainText('Tutor tools will connect here once the backend is enabled.')

  await page.getByRole('button', { name: 'Close help panel' }).click()

  await expect(panel).not.toBeVisible()
})
