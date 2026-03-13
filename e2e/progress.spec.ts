import { test, expect } from '@playwright/test'
import { openProgress } from './helpers/seedAppState'
import {
  progressEmpty,
  progressTodayOnly,
  progressStreak,
  progressMixedStatuses,
  progressDistDuration,
  progressDistCounts,
  progressExpandedNotes,
  progressNoWeakSpots,
  progressNotStartedExpanded,
  progressNoFutureExams,
} from './fixtures/progressState'

const FROZEN_DATE = '2026-04-15'

test('1. Empty progress state', async ({ page }) => {
  await openProgress(page, progressEmpty(), FROZEN_DATE)

  await expect(page.locator('[data-testid="progress-hero"]')).toBeVisible()
  await expect(page.locator('[data-testid="progress-hero-cta"]')).toHaveText("Plan today\u2019s study")
  await expect(page.locator('[data-testid="progress-consistency"]')).not.toBeVisible()
  await expect(page.locator('[data-testid="progress-sessions-list"]')).not.toBeVisible()
  await expect(page.locator('[data-testid="progress-best-next-focus"]')).not.toBeVisible()
  await expect(page.locator('[data-testid="progress-empty-message"]')).toBeVisible()
  // With 0 topics studied and exams ≤30d, all subjects show "At risk soon" — never "On track"
  const chips = page.locator('[data-testid="progress-status-chip"]')
  const allText = await chips.allTextContents()
  expect(allText).not.toContain('On track')
  expect(allText).not.toContain('Not started') // all exams ≤30d triggers "At risk soon" first

  await expect(page).toHaveScreenshot('01-empty.png')
})

test('2. One-day activity', async ({ page }) => {
  await openProgress(page, progressTodayOnly(), FROZEN_DATE)

  await expect(page.locator('[data-testid="progress-hero"]')).toContainText('You studied today')
  // streak=1 → no CTA ("You studied today" is streak=1, showCta is false when hasSessions && streak !== 0)
  await expect(page.locator('[data-testid="progress-hero-cta"]')).not.toBeVisible()
  await expect(page.getByTestId('progress-allocation')).not.toBeVisible()
  // Session outcome chip shows label instead of raw percentage
  await expect(page.locator('[data-testid="progress-outcome-chip"]')).toHaveText('Solid')

  await expect(page).toHaveScreenshot('02-one-day.png')
})

test('3. Active streak', async ({ page }) => {
  await openProgress(page, progressStreak(), FROZEN_DATE)

  await expect(page.locator('[data-testid="progress-hero"]')).toContainText('3 day streak')
  await expect(page.locator('[data-testid="progress-hero-cta"]')).not.toBeVisible()

  await expect(page).toHaveScreenshot('03-streak.png')
})

test('4. Consistency with duration distribution', async ({ page }) => {
  await openProgress(page, progressDistDuration(), FROZEN_DATE)

  await expect(page.getByTestId('progress-allocation')).toBeVisible()
  await expect(page.locator('[data-testid="progress-distribution"]')).toBeVisible()
  // Duration labels should show time format (e.g. "30m", "1h")
  const distText = await page.getByTestId('progress-allocation').textContent()
  expect(distText).toMatch(/\d+m/)

  await expect(page).toHaveScreenshot('04-dist-duration.png')
})

test('5. Distribution fallback to counts', async ({ page }) => {
  await openProgress(page, progressDistCounts(), FROZEN_DATE)

  await expect(page.locator('[data-testid="progress-distribution"]')).toBeVisible()
  // Should show "sessions" label
  const distText = await page.getByTestId('progress-allocation').textContent()
  expect(distText).toMatch(/sessions/)

  await expect(page).toHaveScreenshot('05-dist-counts.png')
})

test('6. Priority subject ordering', async ({ page }) => {
  await openProgress(page, progressMixedStatuses(), FROZEN_DATE)

  const chips = page.locator('[data-testid="progress-status-chip"]')
  await expect(chips).toHaveCount(5)
  // Expected order: At risk soon → Needs attention → Improving → Not started → On track
  await expect(chips.nth(0)).toHaveText('At risk soon')
  await expect(chips.nth(1)).toHaveText('Needs attention')
  await expect(chips.nth(2)).toHaveText('Improving')
  await expect(chips.nth(3)).toHaveText('Not started')
  await expect(chips.nth(4)).toHaveText('On track')

  await expect(page).toHaveScreenshot('06-priority-order.png')
})

test('7. Expanded subject row', async ({ page }) => {
  await openProgress(page, progressExpandedNotes(), FROZEN_DATE)

  // Click to expand the CS row
  const subjectRow = page.locator('[data-testid="progress-subject-row"]').first()
  await subjectRow.locator('button').first().click()

  // Should show average result with hybrid label
  await expect(subjectRow).toContainText("This week's session result")
  // Should show confidence gap message (overconfident)
  await expect(subjectRow).toContainText('confidence is ahead')
  // Should show 3 notes (first 3 of 5)
  const notes = subjectRow.locator('.bg-gray-50')
  await expect(notes).toHaveCount(3)
  // "Show all notes" button visible
  await expect(page.locator('[data-testid="progress-show-all-notes"]')).toBeVisible()

  await expect(page).toHaveScreenshot('07-expanded-row.png')
  await expect(subjectRow).toHaveScreenshot('07-expanded-row-detail.png')
})

test('8. Show all notes interaction', async ({ page }) => {
  await openProgress(page, progressExpandedNotes(), FROZEN_DATE)

  // Expand
  const subjectRow = page.locator('[data-testid="progress-subject-row"]').first()
  await subjectRow.locator('button').first().click()

  // Click "Show all notes"
  await page.locator('[data-testid="progress-show-all-notes"]').click()

  // All 5 notes should be visible
  const notes = subjectRow.locator('.bg-gray-50')
  await expect(notes).toHaveCount(5)

  await expect(page).toHaveScreenshot('08-all-notes.png', { maxDiffPixelRatio: 0.03 })
  await expect(subjectRow).toHaveScreenshot('08-all-notes-detail.png', { maxDiffPixelRatio: 0.03 })
})

test('9. Best next focus visible', async ({ page }) => {
  await openProgress(page, progressStreak(), FROZEN_DATE)

  await expect(page.locator('[data-testid="progress-best-next-focus"]')).toBeVisible()
  await expect(page.locator('[data-testid="progress-best-next-focus"]')).toContainText('Next best focus')

  await expect(page).toHaveScreenshot('09-best-next-focus.png')
})

test('10. No weak spots message', async ({ page }) => {
  await openProgress(page, progressNoWeakSpots(), FROZEN_DATE)

  await expect(page.locator('[data-testid="progress-best-next-focus"]')).toBeVisible()
  await expect(page.locator('[data-testid="progress-best-next-focus"]')).toContainText('Nice work')

  await expect(page).toHaveScreenshot('10-no-weak-spots.png')
})

test('11. Not started expanded panel', async ({ page }) => {
  await openProgress(page, progressNotStartedExpanded(), FROZEN_DATE)

  // Should show "Not started" chip
  const chip = page.locator('[data-testid="progress-status-chip"]').first()
  await expect(chip).toHaveText('Not started')

  // Expand the subject row
  const subjectRow = page.locator('[data-testid="progress-subject-row"]').first()
  await subjectRow.locator('button').first().click()

  // Should show "not started" message, not "Nice work"
  await expect(page.locator('[data-testid="progress-not-started-msg"]')).toBeVisible()
  await expect(page.locator('[data-testid="progress-not-started-msg"]')).toContainText("haven't started this subject")
  // Should show 3 starter topic cards
  const topicCards = page.locator('[data-testid="progress-not-started-msg"] .rounded-lg.bg-white')
  await expect(topicCards).toHaveCount(3)
  // Should NOT show "Nice work"
  await expect(subjectRow).not.toContainText('Nice work')

  await expect(page).toHaveScreenshot('11-not-started-expanded.png')
  await expect(subjectRow).toHaveScreenshot('11-not-started-expanded-detail.png')
})

test('12. No future exams', async ({ page }) => {
  await openProgress(page, progressNoFutureExams(), FROZEN_DATE)

  await expect(page.locator('[data-testid="progress-no-upcoming"]')).toBeVisible()
  await expect(page.locator('[data-testid="progress-no-upcoming"]')).toContainText('No upcoming exams')
  // No subject rows
  await expect(page.locator('[data-testid="progress-subject-row"]')).toHaveCount(0)
  // No best next focus
  await expect(page.locator('[data-testid="progress-best-next-focus"]')).not.toBeVisible()

  await expect(page).toHaveScreenshot('12-no-future-exams.png')
})

test('13. Hero CTA navigation', async ({ page }) => {
  await openProgress(page, progressEmpty(), FROZEN_DATE)

  await page.getByTestId('progress-hero-cta').click()

  // Should navigate to Today page — Today tab should be active
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Today' })).toBeVisible()
})

