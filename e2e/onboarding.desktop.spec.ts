import { test, expect } from './helpers/base'
import { openAppWithState, readIdbState } from './helpers/seedAppState'
import { freshState, returningSimpleState, returningMultiState } from './fixtures/onboardingState'

const FROZEN_DATE = '2026-03-15'

// ── Helpers ──

async function goToEditSetup(page: import('@playwright/test').Page) {
  await page.locator('text=Edit setup').click()
  await expect(page.locator('text=Update your exam setup')).toBeVisible({ timeout: 5000 })
}

async function getPersistedOfferingIds(page: import('@playwright/test').Page): Promise<string[]> {
  const state = await readIdbState(page)
  return (state as Record<string, unknown>)?.selectedOfferingIds as string[] ?? []
}

// ═══════════════════════════════════════════════════════════════════
// 1. INITIAL ONBOARDING: QUALIFICATION SELECTION
// ═══════════════════════════════════════════════════════════════════

test('D1. Initial flow: Get started → qualification picker → GCSE → subject picker', async ({ page }) => {
  await openAppWithState(page, freshState(), FROZEN_DATE)

  // Landing page visible
  await expect(page.getByRole('button', { name: 'Start your revision schedule' }).first()).toBeVisible({ timeout: 5000 })

  // Click Get started
  await page.getByRole('button', { name: 'Start your revision schedule' }).first().click()

  // Qualification picker visible
  await expect(page.locator('text=What are you studying?')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('qual-gcse')).toBeVisible()
  await expect(page.getByTestId('qual-alevel')).toBeVisible()

  // Pick GCSE
  await page.getByTestId('qual-gcse').click()

  // Subject picker appears
  await expect(page.locator('text=Build your exam setup')).toBeVisible({ timeout: 5000 })
})

// ═══════════════════════════════════════════════════════════════════
// 2. DESKTOP BACK BUTTON: CHANGE QUALIFICATION
// ═══════════════════════════════════════════════════════════════════

test('D2. Back button returns to qualification picker', async ({ page }) => {
  await openAppWithState(page, freshState(), FROZEN_DATE)

  await page.getByRole('button', { name: 'Start your revision schedule' }).first().click()
  await page.getByTestId('qual-gcse').click()
  await expect(page.locator('text=Build your exam setup')).toBeVisible({ timeout: 5000 })

  // Click back
  await page.getByTestId('desktop-back-button').click()

  // Qualification picker visible again
  await expect(page.locator('text=What are you studying?')).toBeVisible({ timeout: 5000 })
})

// ═══════════════════════════════════════════════════════════════════
// 3. DESKTOP SUBJECT CONFIGURE HAPPY PATH
// ═══════════════════════════════════════════════════════════════════

test('D3. Configure a subject and start studying', async ({ page }) => {
  await openAppWithState(page, freshState(), FROZEN_DATE)

  await page.getByRole('button', { name: 'Start your revision schedule' }).first().click()
  await page.getByTestId('qual-gcse').click()
  await expect(page.locator('text=Build your exam setup')).toBeVisible({ timeout: 5000 })

  // Finish button starts disabled
  await expect(page.getByTestId('finish-button')).toBeDisabled()

  // Expand Computer Science
  await page.getByTestId('subject-card-cs').locator('[role="button"]').first().click()

  // Select it
  await page.getByTestId('subject-card-cs').locator('button:has-text("Yes, I take this")').click()

  // Only one offering (cs-aqa) → auto-selected. Set confidence.
  await page.getByRole('button', { name: 'Set confidence to 3' }).click()

  // Finish button enabled with "Start studying"
  const finishBtn = page.getByTestId('finish-button')
  await expect(finishBtn).toBeEnabled()
  await expect(finishBtn).toContainText('Start studying')
  await finishBtn.click()

  // Onboarding closes — app shell visible (Today or Home)
  await expect(page.locator('text=Build your exam setup')).not.toBeVisible({ timeout: 5000 })

  // Persisted state has cs-aqa
  const ids = await getPersistedOfferingIds(page)
  expect(ids).toContain('cs-aqa')
})

// ═══════════════════════════════════════════════════════════════════
// 4. DESKTOP SAVE CHANGES IN EDIT MODE
// ═══════════════════════════════════════════════════════════════════

test('D4. Edit mode: save changes persists updates', async ({ page }) => {
  await openAppWithState(page, returningMultiState(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  await goToEditSetup(page)

  // Save changes button visible
  await expect(page.getByTestId('finish-button')).toContainText('Save changes')
  // Cancel button visible
  await expect(page.getByTestId('cancel-button')).toBeVisible()

  // Deselect Geography
  await page.getByTestId('subject-card-geo').locator('[role="button"]').first().click()
  await page.getByTestId('subject-card-geo').locator('button:has-text("Not taking")').click()

  // Save
  await page.getByTestId('finish-button').click()

  // Home visible
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  // IDB: geo-aqa removed
  const ids = await getPersistedOfferingIds(page)
  expect(ids).toContain('cs-aqa')
  expect(ids).not.toContain('geo-aqa')
})

// ═══════════════════════════════════════════════════════════════════
// 5. DESKTOP CANCEL IN EDIT MODE
// ═══════════════════════════════════════════════════════════════════

test('D5. Edit mode: cancel discards changes', async ({ page }) => {
  await openAppWithState(page, returningMultiState(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  // Snapshot IDB before
  const idsBefore = await getPersistedOfferingIds(page)

  await goToEditSetup(page)

  // Deselect Geography
  await page.getByTestId('subject-card-geo').locator('[role="button"]').first().click()
  await page.getByTestId('subject-card-geo').locator('button:has-text("Not taking")').click()

  // Cancel
  await page.getByTestId('cancel-button').click()

  // Home visible
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  // IDB unchanged
  const idsAfter = await getPersistedOfferingIds(page)
  expect(idsAfter.sort()).toEqual(idsBefore.sort())
})

// ═══════════════════════════════════════════════════════════════════
// 6. ADD EXAM OPTION OPENS WIZARD
// ═══════════════════════════════════════════════════════════════════

test('D6. Add exam option opens wizard overlay', async ({ page }) => {
  await openAppWithState(page, returningSimpleState(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  await goToEditSetup(page)

  // Expand CS
  await page.getByTestId('subject-card-cs').locator('[role="button"]').first().click()

  // Click "+ Add exam option"
  await page.locator('text=+ Add exam option').click()

  // Wizard overlay visible
  await expect(page.locator('text=Add an option to')).toBeVisible({ timeout: 5000 })
  await expect(page.locator('text=Choose the exam option details')).toBeVisible()
})
