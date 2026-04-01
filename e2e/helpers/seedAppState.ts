import type { Page } from '@playwright/test'

export interface PersistedState {
  version: 2
  seedRevision?: number
  boards: unknown[]
  subjects: unknown[]
  offerings: unknown[]
  papers: unknown[]
  topics: unknown[]
  sessions: unknown[]
  paperAttempts?: unknown[]
  notes: unknown[]
  userState: { energyLevel: number; stress: number }
  onboarded: boolean
  selectedOfferingIds: string[]
  dailyPlan: unknown[]
  planDay: string
}

/**
 * Opens the Progress tab with the given seeded state and frozen date.
 *
 * 1. Freezes Date via addInitScript
 * 2. Navigates to the app
 * 3. Clears SW, caches, storage, IDB
 * 4. Seeds IDB with `state`
 * 5. Reloads so app initializes from seeded data
 * 6. Clicks Progress tab and waits for hero
 */
export async function openProgress(page: Page, state: PersistedState, frozenDate: string) {
  // 1. Freeze Date globally before any app code runs
  await page.addInitScript((dateStr: string) => {
    const frozen = new Date(dateStr + 'T12:00:00').getTime()
    const OrigDate = Date
    const FakeDate = function (this: Date, ...args: unknown[]) {
      if (args.length === 0) {
        return new OrigDate(frozen)
      }
      // @ts-expect-error — spread into Date constructor
      return new OrigDate(...args)
    } as unknown as DateConstructor
    FakeDate.prototype = OrigDate.prototype
    FakeDate.now = () => frozen
    FakeDate.parse = OrigDate.parse
    FakeDate.UTC = OrigDate.UTC
    // @ts-expect-error — override global Date
    globalThis.Date = FakeDate
  }, frozenDate)

  // 2. Navigate to real origin
  await page.goto('/')

  // 3. Cleanup: unregister SWs, clear caches, clear storage, clear IDB
  await page.evaluate(async () => {
    // Unregister service workers
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    // Clear caches
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
    // Clear storage
    localStorage.clear()
    sessionStorage.clear()
    // Clear IDB state store
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('gcse-scheduler', 2)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('state')) {
          db.createObjectStore('state')
        }
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

  // 4. Seed IDB with state
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

  // 5. Reload so app initializes from seeded IDB with frozen clock
  await page.reload()

  // 6. Wait for app to settle
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })

  // 7. Click Progress tab via hero CTA
  await page.getByTestId('home-hero-view-progress').click()

  // 8. Wait for hero
  await page.getByTestId('progress-hero').waitFor({ state: 'visible', timeout: 5000 })
}
