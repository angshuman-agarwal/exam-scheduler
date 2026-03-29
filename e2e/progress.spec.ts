import { expect, test } from '@playwright/test'
import { openProgress } from './helpers/seedAppState'
import {
  progressEmpty,
  progressExpandedNotes,
  progressMixedStatuses,
  progressNoFutureExams,
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

  await expect(page.getByTestId('progress-hero')).toContainText('3 day streak')
  await expect(page.getByTestId('progress-hero-cta')).toHaveCount(0)
  await expect(page.getByTestId('progress-daily-streak-card')).toContainText('Daily Streak')
  await expect(page.getByTestId('progress-last-session-card')).toContainText('Last Session')
  await expect(page.getByTestId('progress-study-velocity-card')).toContainText('Study Velocity')
  await expect(page.getByTestId('progress-study-velocity-card').getByTestId('progress-velocity-bar')).toHaveCount(6)
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

  const firstRowBefore = (await page.getByTestId('progress-topic-row').first().textContent()) ?? ''
  await expect(page.getByTestId('progress-filter-priority-now')).toBeVisible()
  await expect(page.getByTestId('progress-filter-recently-reviewed')).toBeVisible()

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

test('6. Exam dates in the progress calendar apply the reviewed-date lens without expanding the calendar', async ({ page }) => {
  await openProgress(page, progressMixedStatuses(), FROZEN_DATE)

  const calendar = page.locator('[data-testid="progress-calendar-card"]:visible').first()
  await calendar.getByLabel('Next month').click()
  await calendar.getByRole('button', { name: '5', exact: true }).click()
  await expect(page.getByTestId('progress-day-detail')).toHaveCount(0)
  await expect(page.getByTestId('progress-filter-recently-reviewed')).toContainText('Reviewed on 5 Jun')
  await expect(page.getByTestId('progress-filter-priority-now')).toBeDisabled()
})

test('7. No future exams state shows the informational banner and hides analytics', async ({ page }) => {
  await openProgress(page, progressNoFutureExams(), FROZEN_DATE)

  await expect(page.getByTestId('progress-no-upcoming')).toBeVisible()
  await expect(page.getByTestId('progress-no-upcoming')).toContainText('No upcoming exams in your selected subjects.')
  await expect(page.getByTestId('progress-daily-streak-card')).toHaveCount(0)
  await expect(page.getByTestId('progress-last-session-card')).toHaveCount(0)
  await expect(page.getByTestId('progress-study-velocity-card')).toHaveCount(0)
  await expect(page.getByTestId('progress-calendar-card')).toHaveCount(0)
  await expect(page.getByTestId('progress-topic-table')).toHaveCount(0)
})

test('8. Hero CTA still navigates back to Today', async ({ page }) => {
  await openProgress(page, progressEmpty(), FROZEN_DATE)

  await page.getByTestId('progress-hero-cta').click()

  await expect(page.getByRole('navigation').getByRole('button', { name: 'Today' })).toBeVisible()
})

test('9. Calendar remains visible on tablet-sized progress layout', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1200 })
  await openProgress(page, progressStreak(), FROZEN_DATE)

  await expect(page.locator('[data-testid="progress-calendar-card"]:visible').first()).toBeVisible()
})

test('10. Mobile progress shows topic mastery before the calendar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openProgress(page, progressStreak(), FROZEN_DATE)

  const breakdown = page.getByText('Topic Mastery').first()
  const calendar = page.locator('[data-testid="progress-calendar-card"]:visible').first()

  await expect(breakdown).toBeVisible()
  await expect(calendar).toBeVisible()

  const breakdownBox = await breakdown.boundingBox()
  const calendarBox = await calendar.boundingBox()

  expect(breakdownBox).not.toBeNull()
  expect(calendarBox).not.toBeNull()
  expect((breakdownBox?.y ?? 0) + (breakdownBox?.height ?? 0)).toBeLessThan(calendarBox?.y ?? Number.MAX_SAFE_INTEGER)
})
