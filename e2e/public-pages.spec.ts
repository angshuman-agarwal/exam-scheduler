import { test, expect, type Page } from '@playwright/test'
import seedData from '../src/data/subjects.json' with { type: 'json' }
import { SEED_REVISION } from '../src/lib/constants.ts'
import type { PersistedState } from './helpers/seedAppState'

function onboardingState(): PersistedState {
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
    onboarded: false,
    selectedOfferingIds: [],
    dailyPlan: [],
    planDay: '',
  }
}

function returningState(): PersistedState {
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

async function clearAndSeed(page: Page, state?: PersistedState) {
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

  if (!state) return

  await page.evaluate(async (seededState: PersistedState) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('gcse-scheduler', 2)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('state', 'readwrite')
        tx.objectStore('state').put(seededState, 'app')
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
      }
      req.onerror = () => reject(req.error)
    })
  }, state)
}

test('public homepage shows explore-more card for non-onboarded users', async ({ page }) => {
  await clearAndSeed(page, onboardingState())
  await page.goto('/')
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })

  await expect(page.getByTestId('home-explore-more')).toBeVisible()
  await expect(page.getByTestId('home-explore-card-gcse-planner')).toBeVisible()
})

test('explore-more card opens gcse revision planner page', async ({ page }) => {
  await clearAndSeed(page, onboardingState())
  await page.goto('/')
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })

  await page.getByTestId('home-explore-card-gcse-planner').click()

  await expect(page).toHaveURL(/\/gcse-revision-planner\/?$/)
  await expect(page.getByTestId('seo-page-gcse-revision-planner')).toBeVisible()
})

test('direct gcse revision planner route renders expected public page', async ({ page }) => {
  await clearAndSeed(page)
  await page.goto('/gcse-revision-planner')

  await expect(page.getByTestId('seo-page-gcse-revision-planner')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('GCSE revision planner that helps you know what to study next')
  await expect(page.getByTestId('seo-page-primary-cta')).toBeVisible()
  await expect(page.getByText('Know what to revise next, not just when to revise.')).not.toBeVisible()
})

test('returning-user home does not show explore-more section', async ({ page }) => {
  await clearAndSeed(page, returningState())
  await page.goto('/')
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })

  await expect(page.getByTestId('home-explore-more')).toHaveCount(0)
})

test('hybrid routing does not break existing app navigation', async ({ page }) => {
  await clearAndSeed(page, returningState())
  await page.goto('/')
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })

  await page.getByTestId('home-hero-view-progress').click()
  await expect(page.getByTestId('progress-hero')).toBeVisible()

  await page.getByRole('navigation').getByRole('button', { name: 'Today' }).click()
  await expect(page).toHaveURL(/#today$/)
})
