import { expect, test } from '@playwright/test'
import { openProgress } from './helpers/seedAppState'
import {
  progressEmpty,
  progressExamAndActivitySameDay,
  progressExpandedNotes,
  progressMixedStatuses,
  progressNoFutureExams,
  progressPaperPractice,
  progressSessionContext,
  progressPlanNowSwap,
  progressStreak,
} from './fixtures/progressState'

const FROZEN_DATE = '2026-04-15'

test('1. Empty progress state keeps the CTA path and hides analytics sections', async ({ page }) => {
  await openProgress(page, progressEmpty(), FROZEN_DATE)

  await expect(page.getByTestId('progress-hero')).toBeVisible()
  await expect(page.getByTestId('progress-hero')).toContainText('Performance Overview')
  await expect(page.getByTestId('progress-hero-cta')).toHaveText("Plan today’s study")
  await expect(page.getByTestId('progress-empty-message')).toBeVisible()
  await expect(page.getByTestId('progress-daily-streak-card')).toHaveCount(0)
  await expect(page.getByTestId('progress-last-session-card')).toHaveCount(0)
  await expect(page.getByTestId('progress-study-velocity-card')).toHaveCount(0)
  await expect(page.getByTestId('progress-calendar-card')).toHaveCount(0)
  await expect(page.getByTestId('progress-topic-table')).toHaveCount(0)
})

test('2. Active progress renders the analytics row and compact calendar', async ({ page }) => {
  await openProgress(page, progressStreak(), FROZEN_DATE)
  const calendar = page.locator('[data-testid="progress-calendar-card"]:visible').first()
  const velocityCard = page.getByTestId('progress-study-velocity-card')

  await expect(page.getByTestId('progress-hero')).toContainText('3 day streak')
  await expect(page.getByTestId('progress-hero-cta')).toHaveCount(0)
  await expect(page.getByTestId('progress-daily-streak-card')).toContainText('Daily Streak')
  await expect(page.getByTestId('progress-last-session-card')).toContainText('Last Session')
  await expect(page.getByTestId('progress-study-velocity-card')).toContainText('Study Velocity')
  await expect(velocityCard).toContainText('20')
  await expect(velocityCard).toContainText('10')
  await expect(page.getByText(/min logged/i)).toHaveCount(0)
  await expect(page.getByTestId('progress-study-velocity-card').locator('[data-testid="progress-velocity-bar"]:visible')).toHaveCount(14)
  await expect(calendar).toBeVisible()
  await expect(page.getByTestId('progress-day-detail')).toHaveCount(0)
})

test('3. Clicking a studied date filters the topic grid and toggles the reviewed-date lens', async ({ page }) => {
  await openProgress(page, progressExpandedNotes(), FROZEN_DATE)
  const calendar = page.locator('[data-testid="progress-calendar-card"]:visible').first()

  await page.getByTestId('progress-filter-recently-reviewed').click()
  await expect(page.getByTestId('progress-filter-recently-reviewed')).toContainText('Recently Reviewed')

  await calendar.getByRole('button', { name: '15' }).click()

  await expect(page.getByTestId('progress-day-detail')).toHaveCount(0)
  await expect(page.getByTestId('progress-filter-recently-reviewed')).toContainText('Reviewed on 15 Apr')
  await expect(page.getByTestId('progress-filter-priority-now')).toBeDisabled()
  await expect(page.getByTestId('progress-topic-row')).toHaveCount(2)
  await expect(page.getByTestId('progress-topic-table')).toContainText('Computer Science')
  await expect(page.getByTestId('progress-topic-table')).toContainText('Flowcharts')
  await expect(page.getByTestId('progress-topic-table')).toContainText('Networks')

  await calendar.getByRole('button', { name: '15' }).click()
  await expect(page.getByTestId('progress-filter-recently-reviewed')).toContainText('Recently Reviewed')
  await expect(page.getByTestId('progress-filter-priority-now')).toBeEnabled()
})

test('4. Topic breakdown filters switch the table ordering lens', async ({ page }) => {
  await openProgress(page, progressMixedStatuses(), FROZEN_DATE)
  const velocityCard = page.getByTestId('progress-study-velocity-card')

  const firstRowBefore = (await page.getByTestId('progress-topic-row').first().textContent()) ?? ''
  await expect(page.getByTestId('progress-filter-priority-now')).toBeVisible()
  await expect(page.getByTestId('progress-filter-recently-reviewed')).toBeVisible()
  await expect(velocityCard).toContainText('1.3')
  await expect(velocityCard).toContainText('0.7')

  await page.getByTestId('progress-filter-recently-reviewed').click()
  const firstRowAfterRecent = (await page.getByTestId('progress-topic-row').first().textContent()) ?? ''
  const tableTextAfterRecent = (await page.getByTestId('progress-topic-table').textContent()) ?? ''

  expect(firstRowAfterRecent).not.toEqual(firstRowBefore)
  expect(firstRowAfterRecent).toContain('Yesterday')
  expect(tableTextAfterRecent).not.toContain('Not yet reviewed')

  await page.getByTestId('progress-filter-priority-now').click()
  const firstRowAfterPriority = (await page.getByTestId('progress-topic-row').first().textContent()) ?? ''
  expect(firstRowAfterPriority).toEqual(firstRowBefore)
})

test('5. Calendar keeps a single selected day when switching between dates', async ({ page }) => {
  await openProgress(page, progressStreak(), FROZEN_DATE)

  const calendar = page.locator('[data-testid="progress-calendar-card"]:visible').first()
  const selectedDays = calendar.locator('button[aria-pressed="true"]')

  await calendar.getByRole('button', { name: '15' }).click()
  await expect(selectedDays).toHaveCount(1)
  await expect(calendar.getByRole('button', { name: '15' })).toHaveAttribute('aria-pressed', 'true')

  await calendar.getByRole('button', { name: '14' }).click()
  await expect(selectedDays).toHaveCount(1)
  await expect(calendar.getByRole('button', { name: '15' })).toHaveAttribute('aria-pressed', 'false')
  await expect(calendar.getByRole('button', { name: '14' })).toHaveAttribute('aria-pressed', 'true')
  await expect(calendar.getByRole('button', { name: '15' })).not.toHaveClass(/ring-gray-200/)
})

test('6. Future exam-only dates show the Today-style exam card and hide topic mastery', async ({ page }) => {
  await openProgress(page, progressMixedStatuses(), FROZEN_DATE)

  const calendar = page.locator('[data-testid="progress-calendar-card"]:visible').first()
  await calendar.getByLabel('Next month').click()
  await calendar.locator('[data-date-key="2026-05-05"]').click()
  await expect(page.getByTestId('progress-day-detail')).toHaveCount(0)
  await expect(page.getByTestId('progress-exam-day-panel')).toBeVisible()
  await expect(page.getByTestId('progress-exam-day-panel')).toContainText('Computer Science')
  await expect(page.locator('[data-testid="progress-topic-table"]:visible')).toHaveCount(0)
  await expect(page.locator('[data-testid="progress-topic-breakdown-mobile"]:visible')).toHaveCount(0)
})

test('7. Future exam dates with activity show both the exam card and the filtered topic grid', async ({ page }) => {
  await openProgress(page, progressExamAndActivitySameDay(), FROZEN_DATE)

  const calendar = page.locator('[data-testid="progress-calendar-card"]:visible').first()
  await calendar.getByLabel('Next month').click()
  await calendar.locator('[data-date-key="2026-05-05"]').click()

  await expect(page.getByTestId('progress-exam-day-panel')).toBeVisible()
  await expect(page.getByTestId('progress-filter-recently-reviewed')).toContainText('Reviewed on 5 May')
  await expect(page.getByTestId('progress-topic-row')).toHaveCount(2)
  await expect(page.getByTestId('progress-topic-table')).toContainText('Flowcharts')
  await expect(page.getByTestId('progress-topic-table')).toContainText('Networks')
})

test('8. Clicking a Study Velocity bar syncs the selection back into the calendar and grid', async ({ page }) => {
  await openProgress(page, progressStreak(), FROZEN_DATE)

  const velocityBar = page.getByTestId('progress-study-velocity-card').locator('[data-date-key="2026-04-14"]').first()
  const calendar = page.locator('[data-testid="progress-calendar-card"]:visible').first()

  await velocityBar.click()

  await expect(velocityBar).toHaveAttribute('aria-pressed', 'true')
  await expect(calendar.getByRole('button', { name: '14' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('progress-filter-recently-reviewed')).toContainText('Reviewed on 14 Apr')
})

test('9. No future exams state shows the informational banner and hides analytics', async ({ page }) => {
  await openProgress(page, progressNoFutureExams(), FROZEN_DATE)

  await expect(page.getByTestId('progress-no-upcoming')).toBeVisible()
  await expect(page.getByTestId('progress-no-upcoming')).toContainText('No upcoming exams in your selected subjects.')
  await expect(page.getByTestId('progress-daily-streak-card')).toHaveCount(0)
  await expect(page.getByTestId('progress-last-session-card')).toHaveCount(0)
  await expect(page.getByTestId('progress-study-velocity-card')).toHaveCount(0)
  await expect(page.getByTestId('progress-calendar-card')).toHaveCount(0)
  await expect(page.getByTestId('progress-topic-table')).toHaveCount(0)
})

test('10. Plan Now swaps directly into the Today plan without opening the picker', async ({ page }) => {
  await openProgress(page, progressPlanNowSwap(), FROZEN_DATE)

  await expect(page.getByTestId('progress-plan-now').first()).toBeVisible()
  await page.getByTestId('progress-plan-now').first().click()

  await expect(page).toHaveURL(/#today$/)
  await expect(page.getByText('Study Planner')).toBeVisible()
  await expect(page.getByTestId('subject-picker-primary-swap')).toHaveCount(0)
  await expect(page.getByTestId('today-plan-item')).toHaveCount(4)
  await expect(page.getByTestId('today-plan-item').filter({ hasText: 'Arrays' })).toHaveCount(1)
  await expect(page.getByTestId('today-plan-swapped-indicator')).toHaveCount(1)
  await expect(page.getByTestId('today-plan-item').filter({ hasText: 'Arrays' })).toContainText('Swapped in')
})

test('11. Hero CTA still navigates back to Today', async ({ page }) => {
  await openProgress(page, progressEmpty(), FROZEN_DATE)

  await page.getByTestId('progress-hero-cta').click()

  await expect(page.getByRole('navigation').getByRole('button', { name: 'Today' })).toBeVisible()
})

test('12. Hero pills reset to Recently Reviewed and navigate to Today with normal history', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 })
  await openProgress(page, progressExpandedNotes(), FROZEN_DATE)

  await page.getByTestId('progress-velocity-mobile-carousel').locator('[data-date-key="2026-04-15"]').click()
  await expect(page.getByTestId('progress-filter-recently-reviewed')).toContainText('Reviewed on 15 Apr')
  await expect(page.getByTestId('progress-filter-priority-now')).toBeDisabled()

  await page.getByTestId('progress-hero-recent-pill').click()
  await expect(page.getByTestId('progress-filter-recently-reviewed')).toContainText('Recently Reviewed')
  await expect(page.getByTestId('progress-filter-priority-now')).toBeEnabled()
  await expect(page.getByTestId('progress-clear-reviewed-date')).toHaveCount(0)

  const breakdownBox = await page.getByTestId('progress-topic-breakdown-anchor').boundingBox()
  expect((breakdownBox?.y ?? Number.MAX_SAFE_INTEGER)).toBeLessThan(560)

  await page.getByTestId('progress-hero-next-exam-pill').click()
  await expect(page).toHaveURL(/#today$/)
  await page.goBack()
  await expect(page).toHaveURL(/#progress$/)
})

test('13. Calendar remains visible on tablet-sized progress layout', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1200 })
  await openProgress(page, progressStreak(), FROZEN_DATE)

  await expect(page.locator('[data-testid="progress-calendar-card"]:visible').first()).toBeVisible()
})

test('14. Mobile progress hides the calendar and keeps Topic Mastery as the primary section', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openProgress(page, progressStreak(), FROZEN_DATE)

  const breakdown = page.getByText('Topic Mastery').first()
  const mobileBreakdown = page.locator('[data-testid="progress-topic-breakdown-mobile"]:visible').first()
  const visibleDesktopTable = page.locator('[data-testid="progress-topic-table"]:visible')

  await expect(breakdown).toBeVisible()
  await expect(mobileBreakdown).toBeVisible()
  await expect(visibleDesktopTable).toHaveCount(0)
  await expect(page.locator('[data-testid="progress-calendar-card"]:visible')).toHaveCount(0)
  await expect(page.getByTestId('progress-open-calendar-mobile')).toHaveCount(0)
  await expect(mobileBreakdown).toContainText('Biology')
  await expect(mobileBreakdown).toContainText('Computer Science')
  await expect(mobileBreakdown).toContainText('Action')
  await expect(mobileBreakdown).toContainText('What to do now')
})

test('15. Mobile Study Velocity applies and clears the reviewed-date lens without a calendar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openProgress(page, progressExpandedNotes(), FROZEN_DATE)

  const velocityCard = page.getByTestId('progress-study-velocity-card')
  const carousel = page.getByTestId('progress-velocity-mobile-carousel')
  const velocityBar = carousel.locator('[data-date-key="2026-04-15"]')

  await expect(velocityCard.locator('[data-testid="progress-velocity-bar"]:visible')).toHaveCount(7)
  await expect(page.getByTestId('progress-velocity-mobile-week-label')).toHaveText('This Week')
  await expect(page.getByTestId('progress-velocity-page-dot').nth(1)).toHaveAttribute('aria-pressed', 'true')

  await velocityBar.click()

  await expect(velocityBar).toHaveAttribute('data-selected', 'true')
  await expect(page.getByTestId('progress-velocity-selected-day')).toHaveText('15 Apr')
  await expect(page.getByTestId('progress-filter-recently-reviewed')).toContainText('Reviewed on 15 Apr')
  await expect(page.getByTestId('progress-topic-row-mobile')).toHaveCount(2)
  await expect(page.getByTestId('progress-filter-priority-now')).toBeDisabled()

  await page.getByTestId('progress-filter-recently-reviewed').click()

  await expect(page.getByTestId('progress-filter-recently-reviewed')).toContainText('Recently Reviewed')
  await expect(page.getByTestId('progress-clear-reviewed-date')).toHaveCount(0)
  await expect(page.getByTestId('progress-filter-priority-now')).toBeEnabled()
})

test('15b. Mobile Study Velocity dots and swipe switch between current and previous week', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openProgress(page, progressExpandedNotes(), FROZEN_DATE)

  const velocityCard = page.getByTestId('progress-study-velocity-card')
  const carousel = page.getByTestId('progress-velocity-mobile-carousel')

  await expect(velocityCard.locator('[data-testid="progress-velocity-bar"]:visible')).toHaveCount(7)
  await expect(carousel.locator('[data-date-key="2026-04-15"]')).toBeVisible()
  await expect(page.getByTestId('progress-velocity-mobile-week-label')).toHaveText('This Week')

  await page.getByTestId('progress-velocity-page-dot').nth(0).click()

  await expect(page.getByTestId('progress-velocity-mobile-week-label')).toHaveText('Last Week')
  await expect(carousel.locator('[data-date-key="2026-04-08"]')).toBeVisible()
  await expect(page.getByTestId('progress-velocity-page-dot').nth(0)).toHaveAttribute('aria-pressed', 'true')

  await carousel.evaluate((element) => {
    const startTouch = new Touch({ identifier: 1, target: element, clientX: 120, clientY: 40 })
    const endTouch = new Touch({ identifier: 1, target: element, clientX: 20, clientY: 40 })
    element.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, changedTouches: [startTouch], touches: [startTouch], targetTouches: [startTouch] }))
    element.dispatchEvent(new TouchEvent('touchend', { bubbles: true, changedTouches: [endTouch], touches: [], targetTouches: [] }))
  })

  await expect(page.getByTestId('progress-velocity-mobile-week-label')).toHaveText('This Week')
  await expect(carousel.locator('[data-date-key="2026-04-15"]')).toBeVisible()
  await expect(page.getByTestId('progress-velocity-page-dot').nth(1)).toHaveAttribute('aria-pressed', 'true')
})

test('15c. Mobile Study Velocity still changes week after selecting a bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openProgress(page, progressExpandedNotes(), FROZEN_DATE)

  const carousel = page.getByTestId('progress-velocity-mobile-carousel')
  const currentWeekBar = carousel.locator('[data-date-key="2026-04-15"]')

  await currentWeekBar.click()
  await expect(currentWeekBar).toHaveAttribute('data-selected', 'true')
  await expect(page.getByTestId('progress-velocity-selected-day')).toHaveText('15 Apr')

  await page.getByTestId('progress-velocity-page-dot').nth(0).click()

  await expect(page.getByTestId('progress-velocity-mobile-week-label')).toHaveText('Last Week')
  await expect(carousel.locator('[data-date-key="2026-04-08"]')).toBeVisible()
  await expect(carousel.locator('[data-date-key="2026-04-15"]')).toHaveCount(0)
  await expect(page.getByTestId('progress-velocity-page-dot').nth(0)).toHaveAttribute('aria-pressed', 'true')
})

test('16. Topic Mastery shows overall confidence, action guidance, and reason lines', async ({ page }) => {
  await openProgress(page, progressSessionContext(), FROZEN_DATE)

  const table = page.getByTestId('progress-topic-table')
  const sortingRow = page.getByTestId('progress-topic-row').filter({ hasText: 'Sorting and searching algorithms' })
  const cellsRow = page.getByTestId('progress-topic-row').filter({ hasText: 'Cells tissues organs' })
  const flowchartsRow = page.getByTestId('progress-topic-row').filter({ hasText: 'Flowcharts' })

  await expect(table).toContainText('Overall Confidence')
  await expect(table).toContainText('How well you know it')
  await expect(table).toContainText('Action')
  await expect(table).toContainText('What to do now')
  await expect(sortingRow).toContainText('Last: 75%')
  await expect(sortingRow).toContainText('↑')
  await expect(sortingRow).toContainText('53% mastery')
  await expect(sortingRow).toContainText('Study today')
  await expect(sortingRow).toContainText('exam in 2 days')
  await expect(cellsRow).toContainText('Last: 54%')
  await expect(cellsRow).toContainText('Keep practising')
  await expect(cellsRow).toContainText('not studied in a while')
  await expect(flowchartsRow).toContainText('37% mastery')
  await expect(flowchartsRow).toContainText('Begin this topic')
  await expect(flowchartsRow).toContainText('not studied yet')
  await expect(flowchartsRow.getByTestId('progress-session-trend-pill')).toHaveCount(0)
  await expect(flowchartsRow.getByTestId('progress-paper-note-preview')).toHaveCount(0)
})

test('17. Mobile Topic Mastery shows the same confidence and action context', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openProgress(page, progressSessionContext(), FROZEN_DATE)

  const mobileBreakdown = page.locator('[data-testid="progress-topic-breakdown-mobile"]:visible').first()
  const sortingRow = page.getByTestId('progress-topic-row-mobile').filter({ hasText: 'Sorting and searching algorithms' })
  const cellsRow = page.getByTestId('progress-topic-row-mobile').filter({ hasText: 'Cells tissues organs' })
  const flowchartsRow = page.getByTestId('progress-topic-row-mobile').filter({ hasText: 'Flowcharts' })

  await expect(mobileBreakdown).toContainText('Overall Confidence')
  await expect(mobileBreakdown).toContainText('How well you know it')
  await expect(mobileBreakdown).toContainText('Action')
  await expect(mobileBreakdown).toContainText('What to do now')
  await expect(sortingRow).toContainText('Last: 75%')
  await expect(sortingRow).toContainText('↑')
  await expect(sortingRow).toContainText('53% mastery')
  await expect(sortingRow).toContainText('Study today')
  await expect(sortingRow).toContainText('exam in 2 days')
  await expect(cellsRow).toContainText('Keep practising')
  await expect(cellsRow).toContainText('not studied in a while')
  await expect(flowchartsRow).toContainText('37% mastery')
  await expect(flowchartsRow).toContainText('Begin this topic')
  await expect(flowchartsRow).toContainText('not studied yet')
  await expect(flowchartsRow.getByTestId('progress-session-trend-pill')).toHaveCount(0)
})

test('17b. Topic rows show saved note previews under Action when notes exist', async ({ page }) => {
  await openProgress(page, progressExpandedNotes(), FROZEN_DATE)

  const notedRow = page.getByTestId('progress-topic-row').filter({ hasText: 'Computer Science' }).filter({ hasText: 'Sorting and searching algorithms' })
  await expect(notedRow).toBeVisible()
  await expect(notedRow.getByTestId('progress-paper-note-preview')).toContainText('Revisit merge sort edge cases')
})

test('18. Paper attempts appear in the main breakdown and last-session card like other study activity', async ({ page }) => {
  await openProgress(page, progressPaperPractice(), FROZEN_DATE)

  await expect(
    page.getByTestId('progress-topic-row').filter({ hasText: 'Geography' }).filter({ hasText: 'Paper 1' }),
  ).toHaveCount(0)
  await expect(page.getByTestId('progress-last-session-card')).toContainText('Geography · Paper 1')

  await page.getByTestId('progress-filter-recently-reviewed').click()

  const paperRow = page.getByTestId('progress-topic-row').filter({ hasText: 'Geography' }).filter({ hasText: 'Paper 1' })
  await expect(paperRow).toBeVisible()
  await expect(paperRow).toContainText('Today')
  await expect(paperRow).toContainText('Last: 59%')
  await expect(paperRow).toContainText('2 attempts today')
  await expect(paperRow.getByTestId('progress-paper-note-preview')).toContainText('Rushed the final 8-mark question')
  await expect(page.getByTestId('progress-topic-row').filter({ hasText: 'Geography' }).filter({ hasText: 'Paper 1' })).toHaveCount(1)
})
