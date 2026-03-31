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

function newUserState(): PersistedState {
  return {
    ...onboardedState(),
    onboarded: false,
    selectedOfferingIds: [],
  }
}

async function openWithState(page: Page, state: PersistedState, path = '/') {
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
    // @ts-expect-error override global Date
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

  await page.goto(path)
  await page.reload()
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })
}

test('onboarded user with no hash lands on returning home', async ({ page }) => {
  await openWithState(page, onboardedState())

  await expect(page.getByText("Ready for today's revision?")).toBeVisible()
  await expect(page).toHaveURL(/#home$/)
})

test('non-onboarded user with no hash lands on marketing home', async ({ page }) => {
  await openWithState(page, newUserState())

  await expect(page.getByText('Know what to revise next, not just when to revise.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start your revision schedule' }).first()).toBeVisible()
  await expect(page).toHaveURL(/#home$/)
})

test('explicit today hash opens today page', async ({ page }) => {
  await openWithState(page, onboardedState(), '/#today')

  await expect(page.getByText('Study Planner')).toBeVisible()
})

test('explicit progress hash opens progress page', async ({ page }) => {
  await openWithState(page, onboardedState(), '/#progress')

  await expect(page.getByTestId('progress-hero')).toBeVisible()
})

test('explicit home hash opens returning home for onboarded users', async ({ page }) => {
  await openWithState(page, onboardedState(), '/#home')

  await expect(page.getByText("Ready for today's revision?")).toBeVisible()
})

test('non-onboarded user visiting today hash is kept on marketing home', async ({ page }) => {
  await openWithState(page, newUserState(), '/#today')

  await expect(page.getByText('Know what to revise next, not just when to revise.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start your revision schedule' }).first()).toBeVisible()
  await expect(page).toHaveURL(/#today$/)
})

test('non-onboarded user visiting progress hash is kept on marketing home', async ({ page }) => {
  await openWithState(page, newUserState(), '/#progress')

  await expect(page.getByText('Know what to revise next, not just when to revise.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start your revision schedule' }).first()).toBeVisible()
  await expect(page).toHaveURL(/#progress$/)
})
