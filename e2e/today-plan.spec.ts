import { expect, test, type Page } from '@playwright/test'
import seedData from '../src/data/subjects.json' with { type: 'json' }
import { SEED_REVISION } from '../src/lib/constants.ts'
import type { PersistedState } from './helpers/seedAppState'
import type { TimerSession } from '../src/types/timer'

const FROZEN_DATE = '2026-04-15'

function todayPlanState(): PersistedState {
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

function multiMonthCalendarState(): PersistedState {
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
    selectedOfferingIds: ['bio-aqa'],
    dailyPlan: [],
    planDay: '',
  }
}

function geographyCardState(): PersistedState {
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
    selectedOfferingIds: ['geo-aqa'],
    dailyPlan: [],
    planDay: '',
  }
}

function geographyPaperOnlyState(): PersistedState {
  const state = geographyCardState()
  state.dailyPlan = []
  return state
}

function geographyPastPaperState(): PersistedState {
  const state = geographyCardState()
  state.papers = state.papers.map((paper) => {
    if (paper.id === 'geo-p1') return { ...paper, examDate: '2026-03-01' }
    if (paper.id === 'geo-p2') return { ...paper, examDate: '2026-04-20' }
    if (paper.id === 'geo-p3') return { ...paper, examDate: '2026-04-28' }
    return paper
  })
  return state
}

function mobileTodayPolishState(): PersistedState {
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
    selectedOfferingIds: ['eng-lit-aqa', 'geo-aqa'],
    dailyPlan: [],
    planDay: '',
  }
}

async function openToday(page: Page, state: PersistedState, timerState?: { session: TimerSession | null; settings: { strictModeDefault: boolean; wakeLockEnabled: boolean } }) {
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

  await page.evaluate(async ({ appState, timerState }: { appState: PersistedState; timerState?: { session: TimerSession | null; settings: { strictModeDefault: boolean; wakeLockEnabled: boolean } } }) => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('gcse-scheduler', 2)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('state', 'readwrite')
        tx.objectStore('state').put(appState, 'app')
        if (timerState) {
          tx.objectStore('state').put(timerState, 'timer')
        }
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
      }
      req.onerror = () => reject(req.error)
    })
  }, { appState: state, timerState })

  await page.goto('/#today')
  await page.reload()
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })
}

test('Create suggested plan fills the empty today plan', async ({ page }) => {
  await openToday(page, todayPlanState())

  await expect(page.getByRole('button', { name: 'Create suggested plan' })).toBeVisible()
  await expect(page.getByTestId('today-plan-item')).toHaveCount(0)

  await page.getByRole('button', { name: 'Create suggested plan' }).click()

  await expect(page.getByRole('button', { name: 'Create suggested plan' })).not.toBeVisible()
  await expect(page.getByTestId('today-plan-item')).toHaveCount(4)
  await expect(page.getByTestId('today-plan-remove')).toHaveCount(4)
})

test('Exam calendar navigates from May into June when selected exams span both months', async ({ page }) => {
  await openToday(page, multiMonthCalendarState())

  const nextMonthButton = page.locator('button[aria-label="Next month"]:visible').first()
  await expect(page.locator('h2:visible', { hasText: 'May 2026' }).first()).toBeVisible()
  await nextMonthButton.click()
  await expect(page.locator('h2:visible', { hasText: 'June 2026' }).first()).toBeVisible()
  await expect(page.locator('button:visible').filter({ hasText: /^8$/ }).first()).toBeVisible()
})

test('Back from a Today-opened subject picker returns to Today', async ({ page }) => {
  await openToday(page, todayPlanState())

  await page.locator('[data-date-key="2026-05-13"]:visible').first().click()
  await page.getByTestId('progress-exam-day-panel').getByRole('button', { name: 'Browse topics' }).first().click()
  await expect(page.getByRole('heading', { name: 'Computer Science' })).toBeVisible()

  await page.getByRole('button', { name: 'Back' }).click()

  await expect(page).toHaveURL(/#today$/)
  await expect(page.getByText('Study Planner')).toBeVisible()
})

test('Subject card start full paper CTA preselects the nearest upcoming paper for multi-paper subjects', async ({ page }) => {
  await openToday(page, todayPlanState())

  await page.getByRole('button', { name: 'Full paper for Computer Science' }).click()

  await expect(page.getByRole('heading', { name: 'Computer Science' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start full paper' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Browse topics instead' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Paper 1 13 May' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('13 May')).toBeVisible()
  await expect(page.getByText('Start a timed attempt for Paper 1 and review the score afterwards.')).toBeVisible()

  await page.getByRole('button', { name: 'Paper 2' }).click()

  await expect(page.getByRole('heading', { name: 'Computer Science — Paper 2' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start full paper' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Browse topics instead' })).toBeEnabled()

  await page.getByRole('button', { name: 'Start full paper' }).click()

  await expect(page.getByText('Full paper in progress')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Paper 1' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Paper 2' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Paper 3' })).toHaveCount(0)
})

test('Calendar-selected paper stays preselected on the explicit paper browse screen', async ({ page }) => {
  await openToday(page, todayPlanState())

  await page.locator('[data-date-key="2026-05-13"]:visible').first().click()
  await page.getByTestId('progress-exam-day-panel').getByRole('button', { name: 'Start full paper' }).first().click()

  await expect(page.getByRole('heading', { name: 'Computer Science — Paper 1' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start full paper' })).toBeEnabled()
})

test('Subject card shows every paper countdown for multi-paper subjects', async ({ page }) => {
  await openToday(page, geographyCardState())

  const geographyCard = page
    .locator('div.ios-card')
    .filter({ has: page.getByRole('button', { name: 'Full paper for Geography' }) })
    .first()
  await expect(geographyCard).toContainText(/Paper 1\s*\d{1,2}\s\w{3}\s*·\s*\d+\s*days/)
  await expect(geographyCard).toContainText(/Paper 2\s*\d{1,2}\s\w{3}\s*·\s*\d+\s*days/)
  await expect(geographyCard).toContainText(/Paper 3\s*\d{1,2}\s\w{3}\s*·\s*\d+\s*days/)
})

test('Past papers are not shown as upcoming on the subject card or full paper practice', async ({ page }) => {
  await openToday(page, geographyPastPaperState())

  const geographyCard = page
    .locator('div.ios-card')
    .filter({ has: page.getByRole('button', { name: 'Full paper for Geography' }) })
    .first()
  await expect(geographyCard).toContainText(/Paper 1\s*1 Mar\s*·\s*Exam passed/)
  await expect(geographyCard).toContainText(/Paper 2\s*20 Apr\s*·\s*5 days/)
  await expect(geographyCard).toContainText(/Paper 3\s*28 Apr\s*·\s*13 days/)
  await expect(geographyCard).not.toContainText(/Paper 1\s*1 Mar\s*·\s*1 day/)

  const fullPaperPracticeCard = page.locator('.ios-card').filter({ has: page.getByText('Full paper practice') }).first()
  await expect(fullPaperPracticeCard).toBeVisible()
  await expect(fullPaperPracticeCard).not.toContainText('Geography - Paper 1')
  await expect(fullPaperPracticeCard).toContainText('Geography — Paper 2')
  await expect(fullPaperPracticeCard).toContainText('Exam in 5 days')
})

test('Starting a fresh full paper ignores a previously stopped paper timer session', async ({ page }) => {
  const stoppedPaperTimer: TimerSession = {
    sessionId: 'stopped-paper-session',
    targetType: 'paper',
    targetId: 'geo-p1',
    source: 'picker',
    mode: 'stopped',
    startedAt: new Date('2026-04-15T09:00:00').getTime(),
    pausedAt: null,
    pausedAccumMs: 0,
    hiddenAt: null,
    strictMode: false,
    modeChangedAt: new Date('2026-04-15T09:45:00').getTime(),
  }

  await openToday(page, geographyCardState(), {
    session: stoppedPaperTimer,
    settings: { strictModeDefault: false, wakeLockEnabled: false },
  })

  await page.getByRole('button', { name: 'Full paper for Geography' }).click()

  await expect(page.getByRole('heading', { name: 'Geography' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start full paper' })).toBeEnabled()
  await expect(page.getByRole('heading', { name: 'What did you score?' })).toHaveCount(0)
})

test('Starting a fresh full paper ignores a previously interrupted paper timer session', async ({ page }) => {
  const interruptedPaperTimer: TimerSession = {
    sessionId: 'interrupted-paper-session',
    targetType: 'paper',
    targetId: 'geo-p2',
    source: 'picker',
    mode: 'interrupted',
    startedAt: new Date('2026-04-15T09:00:00').getTime(),
    pausedAt: null,
    pausedAccumMs: 0,
    hiddenAt: null,
    strictMode: true,
    modeChangedAt: new Date('2026-04-15T09:20:00').getTime(),
  }

  await openToday(page, geographyPaperOnlyState(), {
    session: interruptedPaperTimer,
    settings: { strictModeDefault: false, wakeLockEnabled: false },
  })

  await page.getByRole('button', { name: 'Full paper for Geography' }).click()

  await expect(page.getByRole('heading', { name: 'Geography' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start full paper' })).toBeEnabled()
  await expect(page.getByText('Session interrupted')).toHaveCount(0)
})

test('Browse topics instead follows the newly selected paper in the chooser', async ({ page }) => {
  await openToday(page, geographyPaperOnlyState())

  await page.getByRole('button', { name: 'Full paper for Geography' }).click()
  await page.getByRole('button', { name: 'Paper 2' }).click()
  await page.getByRole('button', { name: 'Browse topics instead' }).click()

  await expect(page.getByRole('heading', { name: 'Geography — Paper 2' })).toBeVisible()
  await expect(page.getByText('Start a timed attempt for Paper 2 and review the score afterwards.')).toBeVisible()
})

test('Mobile Today keeps the legend and long subject names readable', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await openToday(page, mobileTodayPolishState())

  await expect(page.getByText('Add topics to plan')).toBeVisible()
  await expect(page.getByText('Nailed it')).toBeVisible()
  await expect(page.getByText('English Literature')).toBeVisible()
})
