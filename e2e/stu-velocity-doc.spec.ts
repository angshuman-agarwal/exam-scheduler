import { expect, test } from '@playwright/test'
import { openProgress, type PersistedState } from './helpers/seedAppState'
import { progressEmpty } from './fixtures/progressState'

const FROZEN_DATE = '2026-04-15'

function cloneState(): PersistedState {
  const state = progressEmpty()
  state.selectedOfferingIds = ['cs-aqa', 'bio-aqa', 'maths-edexcel']
  state.sessions = []
  state.paperAttempts = []
  return structuredClone(state)
}

function dayKey(daysAgo: number) {
  const d = new Date(`${FROZEN_DATE}T12:00:00`)
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

function stamp(daysAgo: number, hour = 18) {
  const d = new Date(`${FROZEN_DATE}T12:00:00`)
  d.setHours(hour, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d.getTime()
}

function makeSession(topicId: string, daysAgo: number, minutes: number, score = 0.72) {
  return {
    id: `sv-${topicId}-${daysAgo}-${Math.random().toString(36).slice(2, 7)}`,
    topicId,
    date: dayKey(daysAgo),
    score,
    durationSeconds: minutes * 60,
    timestamp: stamp(daysAgo, 19),
  }
}

function makePaperAttempt(paperId: string, daysAgo: number, minutes: number, confidence = 4, rawMark = 52, totalMarks = 80) {
  return {
    id: `sv-paper-${paperId}-${daysAgo}-${Math.random().toString(36).slice(2, 7)}`,
    paperId,
    date: dayKey(daysAgo),
    timestamp: stamp(daysAgo, 20),
    durationSeconds: minutes * 60,
    confidence,
    rawMark,
    totalMarks,
    source: 'calendar' as const,
  }
}

async function openScenario(page: Parameters<typeof test>[0]['page'], scenario: { sessions?: PersistedState['sessions']; paperAttempts?: PersistedState['paperAttempts'] }, mobile = false) {
  if (mobile) {
    await page.setViewportSize({ width: 390, height: 844 })
  }

  const state = cloneState()
  state.sessions = scenario.sessions ?? []
  state.paperAttempts = scenario.paperAttempts ?? []
  await openProgress(page, state, FROZEN_DATE)
}

async function assertMobileDefaults(page: Parameters<typeof test>[0]['page']) {
  await expect(page.getByTestId('progress-study-velocity-card').locator('[data-testid="progress-velocity-bar"]:visible')).toHaveCount(7)
  await expect(page.getByTestId('progress-velocity-mobile-week-label')).toHaveText('This Week')
  await expect(page.getByTestId('progress-velocity-page-dot').nth(1)).toHaveAttribute('aria-pressed', 'true')
}

test('1. Empty 14-day window renders safely', async ({ page }) => {
  await openScenario(page, { sessions: [], paperAttempts: [] })

  await expect(page.getByTestId('progress-study-velocity-card')).toHaveCount(0)
  await expect(page.getByTestId('progress-empty-message')).toBeVisible()
})

test('2. Sparse minutes this week stays in minutes and defaults to current week on mobile', async ({ page }) => {
  await openScenario(
    page,
    {
      sessions: [
        makeSession('cs-001', 2, 3),
        makeSession('bio-001', 1, 8),
        makeSession('cs-002', 0, 12),
      ],
    },
    true,
  )

  await assertMobileDefaults(page)
  await expect(page.getByTestId('progress-study-velocity-card')).toContainText('mins')

  const bar = page.getByTestId('progress-velocity-mobile-carousel').locator('[data-date-key="2026-04-15"]')
  await bar.click()
  await expect(bar).toHaveAttribute('data-selected', 'true')
  await expect(page.getByTestId('progress-velocity-selected-day')).toHaveText('15 Apr')

  await page.getByTestId('progress-velocity-page-dot').nth(0).click()
  await expect(page.getByTestId('progress-velocity-mobile-week-label')).toHaveText('Last Week')
  await expect(page.getByTestId('progress-velocity-mobile-carousel').locator('[data-date-key="2026-04-15"]')).toHaveCount(0)
})

test('3. Dense busy current week switches the scale to hours', async ({ page }) => {
  await openScenario(page, {
    sessions: [
      makeSession('maths-001', 6, 70),
      makeSession('maths-002', 5, 95),
      makeSession('cs-001', 4, 80),
      makeSession('bio-001', 3, 105),
      makeSession('cs-002', 2, 65),
      makeSession('bio-002', 1, 120),
      makeSession('cs-003', 0, 90),
    ],
  })

  const velocityCard = page.getByTestId('progress-study-velocity-card')
  await expect(velocityCard).toContainText('hrs')
  await expect(velocityCard).toContainText('2')
})

test('4. Busy last week and quiet this week keeps current week as default mobile page', async ({ page }) => {
  await openScenario(
    page,
    {
      sessions: [
        makeSession('maths-001', 13, 80),
        makeSession('maths-002', 12, 90),
        makeSession('cs-001', 11, 70),
        makeSession('bio-001', 10, 85),
        makeSession('cs-002', 9, 95),
        makeSession('bio-002', 2, 10),
        makeSession('cs-003', 0, 6),
      ],
    },
    true,
  )

  await assertMobileDefaults(page)
  await page.getByTestId('progress-velocity-page-dot').nth(0).click()
  await expect(page.getByTestId('progress-velocity-mobile-week-label')).toHaveText('Last Week')
})

test('5. Busy both weeks keeps stable towers on desktop', async ({ page }) => {
  await openScenario(page, {
    sessions: [
      makeSession('cs-001', 13, 55),
      makeSession('bio-001', 12, 65),
      makeSession('maths-001', 11, 75),
      makeSession('cs-002', 10, 70),
      makeSession('bio-002', 9, 60),
      makeSession('maths-002', 8, 80),
      makeSession('cs-003', 7, 58),
      makeSession('cs-001', 6, 72),
      makeSession('bio-001', 5, 66),
      makeSession('maths-001', 4, 88),
      makeSession('cs-002', 3, 74),
      makeSession('bio-002', 2, 69),
      makeSession('maths-002', 1, 82),
      makeSession('cs-003', 0, 77),
    ],
  })

  await expect(page.getByTestId('progress-study-velocity-card').locator('[data-testid="progress-velocity-bar"]:visible')).toHaveCount(14)
})

test('6. Threshold at 60+ minutes flips the Y-axis to hours', async ({ page }) => {
  await openScenario(page, {
    sessions: [
      makeSession('cs-001', 2, 59),
      makeSession('bio-001', 1, 60),
      makeSession('cs-002', 0, 61),
    ],
  })

  await expect(page.getByTestId('progress-study-velocity-card')).toContainText('hrs')
})

test('7. Paper duration contributes to study velocity bars', async ({ page }) => {
  await openScenario(page, {
    sessions: [
      makeSession('cs-001', 2, 20),
      makeSession('bio-001', 0, 15),
    ],
    paperAttempts: [makePaperAttempt('bio-p1', 1, 90)],
  })

  const paperDayBar = page.getByTestId('progress-study-velocity-card').locator('[data-date-key="2026-04-14"]').first()
  await paperDayBar.click()
  await expect(page.getByTestId('progress-filter-recently-reviewed')).toContainText('Reviewed on 14 Apr')
})

test('8. Previous week selection works on mobile with bold selected date', async ({ page }) => {
  await openScenario(
    page,
    {
      sessions: [
        makeSession('cs-001', 12, 35),
        makeSession('bio-001', 11, 50),
        makeSession('maths-001', 10, 45),
      ],
    },
    true,
  )

  await assertMobileDefaults(page)
  await page.getByTestId('progress-velocity-page-dot').nth(0).click()
  const previousWeekBar = page.getByTestId('progress-velocity-mobile-carousel').locator('[data-date-key="2026-04-05"]')
  await previousWeekBar.click()
  await expect(previousWeekBar).toHaveAttribute('data-selected', 'true')
  await expect(page.getByTestId('progress-velocity-selected-day')).toHaveText('5 Apr')

  await page.getByTestId('progress-velocity-page-dot').nth(1).click()
  await expect(page.getByTestId('progress-velocity-mobile-week-label')).toHaveText('This Week')
  await expect(page.getByTestId('progress-velocity-mobile-carousel').locator('[data-date-key="2026-04-05"]')).toHaveCount(0)
})

test('9. Single active day still feels selectable', async ({ page }) => {
  await openScenario(page, { sessions: [makeSession('cs-001', 0, 25)] }, true)

  await assertMobileDefaults(page)
  const onlyBar = page.getByTestId('progress-velocity-mobile-carousel').locator('[data-date-key="2026-04-15"]')
  await onlyBar.click()
  await expect(onlyBar).toHaveAttribute('data-selected', 'true')
})

test('10. Same-day multi-subject study renders stacked segments', async ({ page }) => {
  await openScenario(page, {
    sessions: [
      makeSession('cs-001', 1, 20),
      makeSession('bio-001', 1, 25),
      makeSession('maths-001', 1, 30),
      makeSession('cs-002', 0, 35),
      makeSession('bio-002', 0, 15),
    ],
  })

  const multiSubjectBar = page.getByTestId('progress-study-velocity-card').locator('[data-date-key="2026-04-14"]').first()
  await expect(multiSubjectBar.locator('span[style*="background-color"]')).toHaveCount(3)
})

test('11. Mobile swipe switches back from last week to this week', async ({ page }) => {
  await openScenario(
    page,
    {
      sessions: [
        makeSession('maths-001', 13, 80),
        makeSession('maths-002', 12, 90),
        makeSession('cs-001', 11, 70),
        makeSession('bio-001', 10, 85),
        makeSession('cs-002', 9, 95),
      ],
    },
    true,
  )

  await page.getByTestId('progress-velocity-page-dot').nth(0).click()
  const carousel = page.getByTestId('progress-velocity-mobile-carousel')
  await carousel.evaluate((element) => {
    const startTouch = new Touch({ identifier: 1, target: element, clientX: 120, clientY: 40 })
    const endTouch = new Touch({ identifier: 1, target: element, clientX: 20, clientY: 40 })
    element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, changedTouches: [startTouch], touches: [startTouch], targetTouches: [startTouch] }))
    element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [endTouch], touches: [], targetTouches: [] }))
  })

  await expect(page.getByTestId('progress-velocity-mobile-week-label')).toHaveText('This Week')
})
