import { expect, test, type Page } from '@playwright/test'
import seedData from '../src/data/subjects.json' with { type: 'json' }
import { SEED_REVISION } from '../src/lib/constants.ts'
import type { PersistedState } from './helpers/seedAppState'
import type { TimerSession, TimerSettings } from '../src/types/timer'

const FROZEN_DATE = '2026-04-15'
const FROZEN_TIME = new Date(FROZEN_DATE + 'T12:00:00').getTime()

function timerState(): PersistedState {
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

async function seedTimer(page: Page, session: TimerSession | null, settings?: Partial<TimerSettings>) {
  await page.evaluate(
    async ({ timerSession, timerSettings }: { timerSession: TimerSession | null; timerSettings: TimerSettings }) => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('gcse-scheduler', 2)
        req.onsuccess = () => {
          const db = req.result
          const tx = db.transaction('state', 'readwrite')
          tx.objectStore('state').put({ session: timerSession, settings: timerSettings }, 'timer')
          tx.oncomplete = () => { db.close(); resolve() }
          tx.onerror = () => { db.close(); reject(tx.error) }
        }
        req.onerror = () => reject(req.error)
      })
    },
    {
      timerSession: session,
      timerSettings: {
        strictModeDefault: false,
        wakeLockEnabled: false,
        ...settings,
      },
    },
  )
}

async function openFirstPlannedSession(page: Page) {
  await openToday(page, timerState())
  await page.getByRole('button', { name: 'Create suggested plan' }).click()
  await expect(page.getByTestId('today-plan-item')).toHaveCount(4)
  await page.getByTestId('today-plan-item').first().click()
  await expect(page.getByRole('button', { name: 'Start Studying' })).toBeVisible()
}

test('starting a planned session enters running timer mode', async ({ page }) => {
  await openFirstPlannedSession(page)
  await expect(page.getByText('Keep screen awake')).toHaveCount(0)

  await page.getByRole('button', { name: 'Start Studying' }).click()

  await expect(page.getByText('Session in progress')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Finish studying' })).toBeVisible()
})

test('pause and resume keep the timer session active', async ({ page }) => {
  await openFirstPlannedSession(page)
  await page.getByRole('button', { name: 'Start Studying' }).click()

  await page.getByRole('button', { name: 'Pause' }).click()
  await expect(page.getByText('Paused')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()

  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.getByText('Session in progress')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
})

test('discarding an active session returns to the plan without removing the item', async ({ page }) => {
  await openFirstPlannedSession(page)
  await page.getByRole('button', { name: 'Start Studying' }).click()

  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByText('Discard session?')).toBeVisible()
  await page.getByRole('button', { name: 'Discard' }).click()

  await expect(page.getByText('Study Planner')).toBeVisible()
  await expect(page.getByTestId('today-plan-item')).toHaveCount(4)
})

test('finishing a session moves into review mode', async ({ page }) => {
  await openFirstPlannedSession(page)
  await page.getByRole('button', { name: 'Start Studying' }).click()

  await page.getByRole('button', { name: 'Finish studying' }).click()
  await expect(page.getByText('End session?')).toBeVisible()
  await page.getByRole('button', { name: 'End session' }).click()

  await expect(page.getByText('How did it go?')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Complete' })).toBeVisible()
})

test('running session reload recovers into paused mode', async ({ page }) => {
  await openToday(page, timerState())
  await seedTimer(page, {
    sessionId: 'ts-running',
    topicId: 'cs-001',
    source: 'manual',
    scheduleItemId: 'si-running',
    mode: 'running',
    startedAt: FROZEN_TIME - 30_000,
    pausedAt: null,
    pausedAccumMs: 0,
    hiddenAt: null,
    strictMode: false,
    modeChangedAt: FROZEN_TIME - 30_000,
  })

  await page.reload()
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })

  await expect(page.getByText('Paused')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
})

test('paused session reload stays paused', async ({ page }) => {
  await openToday(page, timerState())
  await seedTimer(page, {
    sessionId: 'ts-paused',
    topicId: 'cs-001',
    source: 'manual',
    scheduleItemId: 'si-paused',
    mode: 'paused',
    startedAt: FROZEN_TIME - 60_000,
    pausedAt: FROZEN_TIME - 10_000,
    pausedAccumMs: 5_000,
    hiddenAt: null,
    strictMode: false,
    modeChangedAt: FROZEN_TIME - 10_000,
  })

  await page.reload()
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })

  await expect(page.getByText('Paused')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
})

test('returning after being away auto-pauses in normal mode', async ({ page }) => {
  await openToday(page, timerState())
  await seedTimer(page, {
    sessionId: 'ts-away',
    topicId: 'cs-001',
    source: 'manual',
    scheduleItemId: 'si-away',
    mode: 'running',
    startedAt: FROZEN_TIME - 60_000,
    pausedAt: null,
    pausedAccumMs: 0,
    hiddenAt: FROZEN_TIME - 20_000,
    strictMode: false,
    modeChangedAt: FROZEN_TIME - 60_000,
  })

  await page.reload()
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })

  await expect(page.getByText('Paused')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
})

test('strict mode away-too-long reload interrupts the session', async ({ page }) => {
  await openToday(page, timerState())
  await seedTimer(page, {
    sessionId: 'ts-strict-away',
    topicId: 'cs-001',
    source: 'manual',
    scheduleItemId: 'si-strict-away',
    mode: 'running',
    startedAt: FROZEN_TIME - 60_000,
    pausedAt: null,
    pausedAccumMs: 0,
    hiddenAt: FROZEN_TIME - 20_000,
    strictMode: true,
    modeChangedAt: FROZEN_TIME - 60_000,
  })

  await page.reload()
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })

  await expect(page.getByText('Session interrupted')).toBeVisible()
  await expect(page.getByText("This session won't be counted.")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back to Plan' })).toBeVisible()
})
