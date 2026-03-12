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
  notes: unknown[]
  userState: { energyLevel: number; stress: number }
  onboarded: boolean
  selectedOfferingIds: string[]
  dailyPlan: unknown[]
  planDay: string
  studyMode?: 'gcse' | 'alevel' | null
  customBoards?: unknown[]
  customSubjects?: unknown[]
  customOfferings?: unknown[]
  customPapers?: unknown[]
  customTopics?: unknown[]
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

  // 7. Click Progress tab
  await page.getByRole('button', { name: 'View progress' }).click()

  // 8. Wait for hero and active tab
  await page.locator('[data-testid="progress-hero"]').waitFor({ state: 'visible', timeout: 5000 })
  await page.locator('button:has-text("Progress").bg-blue-50').waitFor({ state: 'visible', timeout: 3000 })
}

/**
 * Seeds IDB with the given state and frozen date, then waits for the app to
 * finish loading. Does NOT navigate to any specific tab — the app lands on
 * whatever its default view is (Home / Today).
 */
/**
 * Read the current persisted state from IDB.
 */
export async function readIdbState(page: Page): Promise<PersistedState | null> {
  return page.evaluate(async () => {
    return new Promise<unknown>((resolve, reject) => {
      const req = indexedDB.open('gcse-scheduler', 2)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('state', 'readonly')
        const getReq = tx.objectStore('state').get('app')
        getReq.onsuccess = () => { db.close(); resolve(getReq.result ?? null) }
        getReq.onerror = () => { db.close(); reject(getReq.error) }
      }
      req.onerror = () => reject(req.error)
    })
  }) as Promise<PersistedState | null>
}

export async function openAppWithState(page: Page, state: PersistedState, frozenDate: string) {
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
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
    localStorage.clear()
    sessionStorage.clear()
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
}

// ── E2E bridge helpers ──

/** Wait for the __E2E__ bridge to be available on window */
export async function expectE2EBridge(page: Page) {
  await page.waitForFunction(() => (window as unknown as Record<string, unknown>).__E2E__ != null, undefined, { timeout: 10000 })
}

/** Call a named action on the __E2E__ bridge */
export async function callE2EAction(page: Page, action: string, ...args: unknown[]): Promise<unknown> {
  return page.evaluate(({ action, args }) => {
    const bridge = (window as unknown as Record<string, unknown>).__E2E__ as Record<string, (...a: unknown[]) => unknown> | undefined
    if (!bridge) throw new Error('E2E bridge not available')
    if (typeof bridge[action] !== 'function') throw new Error(`E2E bridge action "${action}" not found`)
    return bridge[action](...args)
  }, { action, args })
}

/** Read state through the E2E bridge */
export async function readE2EState(page: Page): Promise<{
  notes: Array<{ id: string; topicId: string; text: string; date: string }>
  sessions: Array<{ id: string; topicId: string; date: string; score: number }>
  topics: Array<{ id: string; offeringId: string; name: string }>
  dailyPlan: Array<{ id: string; topicId: string; source: string }>
  selectedOfferingIds: string[]
  pendingTierConfirmations: string[]
}> {
  return page.evaluate(() => {
    const bridge = (window as unknown as Record<string, unknown>).__E2E__ as Record<string, () => unknown>
    return bridge.readState()
  })
}

const MIGRATED_DELIM = '-migrated-'

function extractOrigins(items: Array<{ id: string }>): Set<string> {
  const origins = new Set<string>()
  for (const item of items) {
    const idx = item.id.indexOf(MIGRATED_DELIM)
    origins.add(idx >= 0 ? item.id.slice(0, idx) : item.id)
  }
  return origins
}

/** Extract origin IDs from note IDs (deduplicates mirrored copies) */
export function extractNoteOrigins(notes: Array<{ id: string }>): Set<string> {
  return extractOrigins(notes)
}

/** Extract origin IDs from session IDs (deduplicates mirrored copies) */
export function extractSessionOrigins(sessions: Array<{ id: string }>): Set<string> {
  return extractOrigins(sessions)
}

/** Extract origin IDs from plan item IDs (deduplicates mirrored copies) */
export function extractPlanOrigins(items: Array<{ id: string }>): Set<string> {
  return extractOrigins(items)
}
