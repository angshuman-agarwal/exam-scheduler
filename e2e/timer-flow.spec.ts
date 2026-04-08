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

function paperEligibleState(): PersistedState {
  const state = timerState()
  const nextWeekPaper = state.papers.find((paper) => paper.id === 'cs-p1')
  if (nextWeekPaper) nextWeekPaper.examDate = '2026-04-20'
  return state
}

function multiPaperEligibleState(): PersistedState {
  const state = timerState()
  const p1 = state.papers.find((p) => p.id === 'cs-p1')
  const p2 = state.papers.find((p) => p.id === 'cs-p2')
  if (p1) p1.examDate = '2026-04-20'
  if (p2) p2.examDate = '2026-04-27'
  return state
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

async function readTimer(page: Page) {
  return page.evaluate(async () => {
    return new Promise<{ session: TimerSession | null; settings: TimerSettings } | undefined>((resolve, reject) => {
      const req = indexedDB.open('gcse-scheduler', 2)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('state', 'readonly')
        const getReq = tx.objectStore('state').get('timer')
        getReq.onsuccess = () => {
          const result = getReq.result as { session: TimerSession | null; settings: TimerSettings } | undefined
          db.close()
          resolve(result)
        }
        getReq.onerror = () => {
          db.close()
          reject(getReq.error)
        }
      }
      req.onerror = () => reject(req.error)
    })
  })
}

async function readApp(page: Page) {
  return page.evaluate(async () => {
    return new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
      const req = indexedDB.open('gcse-scheduler', 2)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('state', 'readonly')
        const getReq = tx.objectStore('state').get('app')
        getReq.onsuccess = () => {
          const result = getReq.result as Record<string, unknown> | undefined
          db.close()
          resolve(result)
        }
        getReq.onerror = () => {
          db.close()
          reject(getReq.error)
        }
      }
      req.onerror = () => reject(req.error)
    })
  })
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

test('view progress after consecutive subject sessions leaves the picker flow and opens Progress', async ({ page }) => {
  await openToday(page, timerState())
  await page.getByRole('button', { name: 'Create suggested plan' }).click()

  await page.getByTestId('today-plan-item').nth(0).click()
  await expect(page.getByRole('button', { name: 'Start Studying' })).toBeVisible()
  await page.getByRole('button', { name: 'Start Studying' }).click()
  await page.getByRole('button', { name: 'Finish studying' }).click()
  await page.getByRole('button', { name: 'End session' }).click()
  await page.getByRole('button', { name: 'Confidence 2 of 5' }).click()
  await page.getByRole('button', { name: 'Complete' }).click()
  await page.getByRole('button', { name: 'Back to plan' }).click()

  await page.getByTestId('today-plan-item').nth(0).click()
  await expect(page.getByRole('button', { name: 'Start Studying' })).toBeVisible()
  await page.getByRole('button', { name: 'Start Studying' }).click()
  await page.getByRole('button', { name: 'Finish studying' }).click()
  await page.getByRole('button', { name: 'End session' }).click()
  await page.getByRole('button', { name: 'Confidence 4 of 5' }).click()
  await page.getByRole('button', { name: 'Complete' }).click()
  await page.getByRole('button', { name: 'View progress' }).click()

  await expect(page).toHaveURL(/#progress$/)
  await expect(page.getByTestId('progress-hero')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Computer Science' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Start Studying' })).toHaveCount(0)
})

test('running session reload recovers into paused mode', async ({ page }) => {
  await openToday(page, timerState())
  await seedTimer(page, {
    sessionId: 'ts-running',
    targetType: 'topic',
    targetId: 'cs-001',
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
    targetType: 'topic',
    targetId: 'cs-001',
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
    targetType: 'topic',
    targetId: 'cs-001',
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
    targetType: 'topic',
    targetId: 'cs-001',
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

test('starting a full paper from Today opens the paper timer and saves the review', async ({ page }) => {
  await openToday(page, paperEligibleState())

  const fullPaperPracticeCard = page.locator('.ios-card').filter({ has: page.getByText('Full paper practice') }).first()
  await expect(fullPaperPracticeCard).toBeVisible()
  await fullPaperPracticeCard.getByRole('button', { name: 'Start full paper' }).click()
  await expect(page.getByRole('button', { name: 'Browse topics instead' })).toBeVisible()
  await expect(page.getByText('Keep screen awake')).toHaveCount(0)

  await page.getByRole('button', { name: 'Start full paper' }).click()
  await expect(page.getByText('Full paper in progress')).toBeVisible()

  await page.getByRole('button', { name: 'Finish paper' }).click()
  await expect(page.getByText('End paper?')).toBeVisible()
  await page.getByRole('button', { name: 'End paper' }).click()

  await expect(page.getByText('What did you score?')).toBeVisible()
  await page.getByLabel('Raw mark').fill('47')
  await page.getByLabel('Total marks').fill('80')
  await page.getByRole('button', { name: '😕' }).click()
  await page.getByRole('button', { name: 'Complete' }).click()

  await expect(page.getByText('Paper saved')).toBeVisible()
})

test('paper review topics stay collapsed until expanded and still allow tagging topics', async ({ page }) => {
  await openToday(page, paperEligibleState())

  const fullPaperPracticeCard = page.locator('.ios-card').filter({ has: page.getByText('Full paper practice') }).first()
  await fullPaperPracticeCard.getByRole('button', { name: 'Start full paper' }).click()
  await page.getByRole('button', { name: 'Start full paper' }).click()
  await page.getByRole('button', { name: 'Finish paper' }).click()
  await page.getByRole('button', { name: 'End paper' }).click()

  await expect(page.getByRole('heading', { name: 'Which topics need work?' })).toBeVisible()
  const revisitTopicsToggle = page.getByRole('button', { name: /topics\s+Revisit topics/i })
  const firstTopicChip = page.getByRole('button', { name: 'Sorting and searching algorithms' })
  await expect(revisitTopicsToggle).toHaveAttribute('aria-expanded', 'false')
  await expect(firstTopicChip).toBeHidden()

  await revisitTopicsToggle.click()
  await expect(revisitTopicsToggle).toHaveAttribute('aria-expanded', 'true')
  await expect(firstTopicChip).toBeVisible()
  await firstTopicChip.click()
  await expect(page.getByText('1 selected')).toBeVisible()
  await expect(page.getByText('1 flagged')).toBeVisible()
})

test('paper saved view progress opens Progress without leaving paper flow UI behind', async ({ page }) => {
  await openToday(page, paperEligibleState())

  const fullPaperPracticeCard = page.locator('.ios-card').filter({ has: page.getByText('Full paper practice') }).first()
  await expect(fullPaperPracticeCard).toBeVisible()
  await fullPaperPracticeCard.getByRole('button', { name: 'Start full paper' }).click()
  await expect(page.getByRole('button', { name: 'Browse topics instead' })).toBeVisible()

  await page.getByRole('button', { name: 'Start full paper' }).click()
  await expect(page.getByText('Full paper in progress')).toBeVisible()

  await page.getByRole('button', { name: 'Finish paper' }).click()
  await expect(page.getByText('End paper?')).toBeVisible()
  await page.getByRole('button', { name: 'End paper' }).click()

  await expect(page.getByText('What did you score?')).toBeVisible()
  await page.getByLabel('Raw mark').fill('47')
  await page.getByLabel('Total marks').fill('80')
  await page.getByRole('button', { name: '🙂' }).click()
  await page.getByRole('button', { name: 'Complete' }).click()

  await expect(page.getByText('Paper saved')).toBeVisible()
  await expect(page.getByText('Choose paper')).toHaveCount(0)
  await expect(page.getByText('Full paper practice')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Start full paper' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Browse topics instead' })).toHaveCount(0)
  await page.getByRole('button', { name: 'View progress' }).click()

  await expect(page).toHaveURL(/#progress$/)
  await expect(page.getByTestId('progress-hero')).toBeVisible()
  await expect(page.getByText('Paper saved')).toHaveCount(0)
  await expect(page.getByText('Full paper in progress')).toHaveCount(0)
})

test('paper pre-start can route into paper-scoped topic browsing', async ({ page }) => {
  await openToday(page, paperEligibleState())
  const fullPaperPracticeCard = page.locator('.ios-card').filter({ has: page.getByText('Full paper practice') }).first()
  await fullPaperPracticeCard.getByRole('button', { name: 'Start full paper' }).click()
  await page.getByRole('button', { name: 'Browse topics instead' }).click()

  await expect(page.getByText('Computer Science — Paper 1')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start full paper' })).toHaveCount(1)
})

test('paper session reload recovers into paused mode', async ({ page }) => {
  await openToday(page, paperEligibleState())
  await seedTimer(page, {
    sessionId: 'paper-running',
    targetType: 'paper',
    targetId: 'cs-p1',
    source: 'today-suggestion',
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

  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible()
})

test('paper timer recovery discards a deleted paper target gracefully', async ({ page }) => {
  await openToday(page, paperEligibleState())
  await seedTimer(page, {
    sessionId: 'paper-missing-target',
    targetType: 'paper',
    targetId: 'cs-p1',
    source: 'today-suggestion',
    mode: 'running',
    startedAt: FROZEN_TIME - 30_000,
    pausedAt: null,
    pausedAccumMs: 0,
    hiddenAt: null,
    strictMode: false,
    modeChangedAt: FROZEN_TIME - 30_000,
  })

  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('gcse-scheduler', 2)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('state', 'readwrite')
        const store = tx.objectStore('state')
        const getReq = store.get('app')
        getReq.onsuccess = () => {
          const app = getReq.result
          app.papers = app.papers.filter((paper: { id: string }) => paper.id !== 'cs-p1')
          store.put(app, 'app')
        }
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
      }
      req.onerror = () => reject(req.error)
    })
  })

  await page.reload()
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })

  await expect(page.getByText('Study Planner')).toBeVisible()
  await expect(page.getByText('Full paper in progress')).toHaveCount(0)
  await expect(page.getByText('Paper saved')).toHaveCount(0)
  await expect.poll(async () => {
    const timer = await readTimer(page)
    return timer === undefined || timer.session === null
  }).toBe(true)

  await page.reload()
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })
  await expect(page.getByText('Study Planner')).toBeVisible()
  await expect(page.getByText('Full paper in progress')).toHaveCount(0)
  await expect.poll(async () => {
    const timer = await readTimer(page)
    return timer === undefined || timer.session === null
  }).toBe(true)
})

test('legacy timer embedded on the app key is cleared on reload and does not block a new paper launch', async ({ page }) => {
  await openToday(page, paperEligibleState())

  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('gcse-scheduler', 2)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('state', 'readwrite')
        const store = tx.objectStore('state')
        const getReq = store.get('app')
        getReq.onsuccess = () => {
          const app = structuredClone(getReq.result)
          app.timer = {
            session: {
              type: 'paper',
              targetId: 'cs-p1',
              startedAt: Date.now() - 120000,
              pausedAt: null,
              elapsed: 0,
            },
            settings: {},
          }
          store.put(app, 'app')
        }
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
      }
      req.onerror = () => reject(req.error)
    })
  })

  await page.reload()
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })

  await expect(page.getByText('Study Planner')).toBeVisible()
  await expect(page.getByText('Full paper in progress')).toHaveCount(0)
  await expect(page.getByText('Paper saved')).toHaveCount(0)

  await expect.poll(async () => {
    const app = await readApp(page)
    return Object.prototype.hasOwnProperty.call(app ?? {}, 'timer')
  }).toBe(false)

  const fullPaperPracticeCard = page.locator('.ios-card').filter({ has: page.getByText('Full paper practice') }).first()
  await fullPaperPracticeCard.getByRole('button', { name: 'Start full paper' }).click()
  await page.getByRole('button', { name: 'Start full paper' }).click()

  await expect(page.getByText('Full paper in progress')).toBeVisible()
  await expect.poll(async () => {
    const timer = await readTimer(page)
    return timer?.session?.targetId ?? null
  }).toBe('cs-p1')
})

test('topic timer recovery discards a deleted topic target gracefully', async ({ page }) => {
  await openToday(page, timerState())
  await seedTimer(page, {
    sessionId: 'topic-missing-target',
    targetType: 'topic',
    targetId: 'cs-001',
    source: 'suggested',
    mode: 'running',
    startedAt: FROZEN_TIME - 30_000,
    pausedAt: null,
    pausedAccumMs: 0,
    hiddenAt: null,
    strictMode: false,
    modeChangedAt: FROZEN_TIME - 30_000,
  })

  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('gcse-scheduler', 2)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('state', 'readwrite')
        const store = tx.objectStore('state')
        const getReq = store.get('app')
        getReq.onsuccess = () => {
          const app = getReq.result
          app.topics = app.topics.filter((topic: { id: string }) => topic.id !== 'cs-001')
          store.put(app, 'app')
        }
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
      }
      req.onerror = () => reject(req.error)
    })
  })

  await page.reload()
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })

  await expect(page.getByText('Study Planner')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start Studying' })).toHaveCount(0)
  await expect.poll(async () => {
    const timer = await readTimer(page)
    return timer === undefined || timer.session === null
  }).toBe(true)

  await page.reload()
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })
  await expect(page.getByText('Study Planner')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start Studying' })).toHaveCount(0)
  await expect.poll(async () => {
    const timer = await readTimer(page)
    return timer === undefined || timer.session === null
  }).toBe(true)
})

test('stopped paper review reload restores with a save reminder banner', async ({ page }) => {
  await openToday(page, paperEligibleState())
  await seedTimer(page, {
    sessionId: 'paper-stopped-review',
    targetType: 'paper',
    targetId: 'cs-p1',
    source: 'today-suggestion',
    mode: 'stopped',
    startedAt: FROZEN_TIME - 600_000,
    pausedAt: null,
    pausedAccumMs: 0,
    hiddenAt: null,
    strictMode: false,
    modeChangedAt: FROZEN_TIME - 60_000,
  })

  await page.reload()
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })

  await expect(page.getByText('Unfinished paper review restored')).toBeVisible()
  await expect(page.getByText('Complete review to save this attempt.')).toBeVisible()
  await expect(page.getByText('What did you score?')).toBeVisible()
  await page.getByRole('button', { name: '😐' }).click()
  await page.getByRole('button', { name: 'Complete' }).click()
  await expect(page.getByText('Paper saved')).toBeVisible()
})

test('completed paper review clears the stopped timer so reload does not restore it or duplicate the attempt', async ({ page }) => {
  await openToday(page, paperEligibleState())

  const fullPaperPracticeCard = page.locator('.ios-card').filter({ has: page.getByText('Full paper practice') }).first()
  await fullPaperPracticeCard.getByRole('button', { name: 'Start full paper' }).click()
  await page.getByRole('button', { name: 'Start full paper' }).click()
  await page.getByRole('button', { name: 'Finish paper' }).click()
  await page.getByRole('button', { name: 'End paper' }).click()

  await page.getByLabel('Raw mark').fill('70')
  await page.getByLabel('Total marks').fill('80')
  await page.getByRole('button', { name: '🤩' }).click()
  await page.getByRole('button', { name: 'Complete' }).click()
  await expect(page.getByText('Paper saved')).toBeVisible()

  await page.reload()
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })

  await expect(page.getByText('What did you score?')).toHaveCount(0)
  await expect(page.getByText('Unfinished paper review restored')).toHaveCount(0)
  await expect(page.getByText('Study Planner')).toBeVisible()

  const paperAttemptCount = await page.evaluate(async () => {
    return await new Promise<number>((resolve, reject) => {
      const req = indexedDB.open('gcse-scheduler', 2)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('state', 'readonly')
        const getReq = tx.objectStore('state').get('app')
        getReq.onsuccess = () => {
          const app = getReq.result
          const count = (app.paperAttempts ?? []).filter((attempt: { paperId: string }) => attempt.paperId === 'cs-p1').length
          db.close()
          resolve(count)
        }
        getReq.onerror = () => {
          db.close()
          reject(getReq.error)
        }
      }
      req.onerror = () => reject(req.error)
    })
  })

  expect(paperAttemptCount).toBe(1)
})

test('selecting Paper 2 in the picker shows Paper 2 on the active session screen', async ({ page }) => {
  await openToday(page, multiPaperEligibleState())

  // Click the Full paper button for Computer Science (aria-label targets it precisely)
  await page.getByRole('button', { name: 'Full paper for Computer Science' }).click()

  // Paper picker should be visible with both options
  await expect(page.getByText('Choose paper')).toBeVisible()

  // Use aria-pressed attribute to scope specifically to the picker toggle buttons
  const pickerButtons = page.locator('[aria-pressed]')
  await expect(pickerButtons.filter({ hasText: 'Paper 1' })).toBeVisible()
  await expect(pickerButtons.filter({ hasText: 'Paper 2' })).toBeVisible()

  // Select Paper 2
  await pickerButtons.filter({ hasText: 'Paper 2' }).click()

  // Start the session
  await page.getByRole('button', { name: 'Start full paper' }).click()

  // Active screen must show Paper 2, not Paper 1
  await expect(page.getByText('Computer Science — Paper 2')).toBeVisible()
  await expect(page.getByText('Computer Science — Paper 1')).toHaveCount(0)
})
