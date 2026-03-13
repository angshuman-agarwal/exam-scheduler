import { test, expect } from './helpers/base'
import { openAppWithState, readIdbState } from './helpers/seedAppState'
import { freshState, returningSimpleState, returningMultiState } from './fixtures/onboardingState'

const FROZEN_DATE = '2026-03-15'

test.use({ viewport: { width: 375, height: 812 } })

// ── Helpers ──

async function getPersistedOfferingIds(page: import('@playwright/test').Page): Promise<string[]> {
  const state = await readIdbState(page)
  return (state as Record<string, unknown>)?.selectedOfferingIds as string[] ?? []
}

/** Start fresh onboarding and pick GCSE, landing on mobile subject picker */
async function freshGcsePicker(page: import('@playwright/test').Page) {
  await openAppWithState(page, freshState(), FROZEN_DATE)
  await page.getByRole('button', { name: 'Start your revision schedule' }).first().click()
  await expect(page.locator('text=What are you studying?')).toBeVisible({ timeout: 5000 })
  await page.getByTestId('qual-gcse').click()
  await expect(page.locator('text=Pick your subjects')).toBeVisible({ timeout: 5000 })
}

/** Tap a subject row in the mobile picker by visible text */
async function tapMobileSubjectRow(page: import('@playwright/test').Page, subjectName: string) {
  // Subject rows are buttons inside the mobile picker; use getByRole to target the clickable row
  await page.getByRole('button', { name: subjectName }).first().click()
}

// ═══════════════════════════════════════════════════════════════════
// 1. MOBILE PICKER BACK BUTTON IN INITIAL FLOW
// ═══════════════════════════════════════════════════════════════════

test('M1. Mobile back from picker returns to qualification picker', async ({ page }) => {
  await freshGcsePicker(page)

  await expect(page.getByTestId('mobile-back-button')).toBeVisible()
  await page.getByTestId('mobile-back-button').click()

  await expect(page.locator('text=What are you studying?')).toBeVisible({ timeout: 5000 })
})

// ═══════════════════════════════════════════════════════════════════
// 2. MOBILE EDIT-MODE BACK BUTTON
// ═══════════════════════════════════════════════════════════════════

test('M2. Mobile edit-mode: footer CTA is the exit mechanism', async ({ page }) => {
  await openAppWithState(page, returningSimpleState(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  // Enter edit
  await page.locator('text=Edit setup').click()
  await expect(page.locator('text=Update your subjects')).toBeVisible({ timeout: 5000 })

  // No back button in edit mode (onCancel + persisted studyMode → null handler → hidden)
  // Footer CTA is the exit path
  await expect(page.getByTestId('mobile-footer-cta')).toBeVisible()
  await expect(page.getByTestId('mobile-footer-cta')).toContainText('Save changes')

  // Save → returns to Home
  await page.getByTestId('mobile-footer-cta').click()
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })
})

// ═══════════════════════════════════════════════════════════════════
// 3. MOBILE SUBJECT ROW TAP OPENS CONFIG
// ═══════════════════════════════════════════════════════════════════

test('M3. Tapping subject row opens config view', async ({ page }) => {
  await freshGcsePicker(page)

  await tapMobileSubjectRow(page, 'Computer Science')

  // Config view visible with subject heading
  await expect(page.locator('h2:has-text("Computer Science")')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('mobile-config-back-button')).toBeVisible()
})

// ═══════════════════════════════════════════════════════════════════
// 4. MOBILE CONFIG BACK RETURNS TO PICKER
// ═══════════════════════════════════════════════════════════════════

test('M4. Config back button returns to picker', async ({ page }) => {
  await freshGcsePicker(page)

  await tapMobileSubjectRow(page, 'Computer Science')
  await expect(page.locator('h2:has-text("Computer Science")')).toBeVisible({ timeout: 5000 })

  await page.getByTestId('mobile-config-back-button').click()

  await expect(page.locator('text=Pick your subjects')).toBeVisible({ timeout: 5000 })
})

// ═══════════════════════════════════════════════════════════════════
// 5. MOBILE FOOTER CTA: CONFIGURE ROUTES TO FIRST INCOMPLETE
// ═══════════════════════════════════════════════════════════════════

test('M5. Footer Configure routes to first incomplete subject', async ({ page }) => {
  await freshGcsePicker(page)

  // Select and fully configure Computer Science
  await tapMobileSubjectRow(page, 'Computer Science')
  await expect(page.locator('h2:has-text("Computer Science")')).toBeVisible({ timeout: 5000 })
  // CS has single offering → auto-selected. Set confidence.
  await page.getByRole('button', { name: 'Set confidence to 3' }).click()
  // Back to picker
  await page.getByTestId('mobile-config-back-button').click()
  await expect(page.locator('text=Pick your subjects')).toBeVisible({ timeout: 5000 })

  // Now tap Geography to select it (goes to config)
  await tapMobileSubjectRow(page, 'Geography')
  await expect(page.locator('h2:has-text("Geography")')).toBeVisible({ timeout: 5000 })
  // Go back without configuring
  await page.getByTestId('mobile-config-back-button').click()
  await expect(page.locator('text=Pick your subjects')).toBeVisible({ timeout: 5000 })

  // Footer should show amber "Configure" button
  const footer = page.getByTestId('mobile-footer-cta')
  await expect(footer).toContainText('Configure')

  // Tap Configure → opens config for the incomplete subject
  await footer.click()
  await expect(page.locator('h2:has-text("Geography")')).toBeVisible({ timeout: 5000 })
})

// ═══════════════════════════════════════════════════════════════════
// 6. MOBILE SAVE CHANGES PERSISTS UPDATES
// ═══════════════════════════════════════════════════════════════════

test('M6. Mobile edit: save changes persists offering update', async ({ page }) => {
  await openAppWithState(page, returningMultiState(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  // Enter edit
  await page.locator('text=Edit setup').click()
  await expect(page.locator('text=Update your subjects')).toBeVisible({ timeout: 5000 })

  // Tap Geography to enter config
  await tapMobileSubjectRow(page, 'Geography')
  await expect(page.locator('h2:has-text("Geography")')).toBeVisible({ timeout: 5000 })

  // Remove subject
  await page.getByRole('button', { name: 'Remove subject' }).click()

  // Back to picker
  await expect(page.locator('text=Update your subjects')).toBeVisible({ timeout: 5000 })

  // Footer save
  await page.getByTestId('mobile-footer-cta').click()

  // Home visible
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  // IDB: geo-aqa removed
  const ids = await getPersistedOfferingIds(page)
  expect(ids).toContain('cs-aqa')
  expect(ids).not.toContain('geo-aqa')
})

// ═══════════════════════════════════════════════════════════════════
// 7. MOBILE CONFIG FOOTER: "Back" WHEN NOT YET CONFIGURED
// ═══════════════════════════════════════════════════════════════════

test('M7. Config footer shows "Back" before subject is configured', async ({ page }) => {
  await freshGcsePicker(page)

  // Tap into Geography config (has multiple offerings → nothing auto-selected)
  await tapMobileSubjectRow(page, 'Geography')
  await expect(page.locator('h2:has-text("Geography")')).toBeVisible({ timeout: 5000 })

  // Footer shows "Back" (gray, not configured yet)
  const footer = page.getByTestId('mobile-config-footer-cta')
  await expect(footer).toContainText('Back')
  // Not "Back to subjects" or "Next subject"
  await expect(footer).not.toContainText('Next subject')
  await expect(footer).not.toContainText('Back to subjects')

  // Tapping it returns to picker
  await footer.click()
  await expect(page.locator('text=Pick your subjects')).toBeVisible({ timeout: 5000 })
})

// ═══════════════════════════════════════════════════════════════════
// 8. MOBILE CONFIG FOOTER: "Next subject" ADVANCES TO UNCONFIGURED
// ═══════════════════════════════════════════════════════════════════

test('M8. Config footer "Next subject" advances to next unconfigured', async ({ page }) => {
  await freshGcsePicker(page)

  // Select CS (goes to config, single offering auto-selected)
  await tapMobileSubjectRow(page, 'Computer Science')
  await expect(page.locator('h2:has-text("Computer Science")')).toBeVisible({ timeout: 5000 })

  // Also select Geography by going back and tapping it
  await page.getByTestId('mobile-config-back-button').click()
  await expect(page.locator('text=Pick your subjects')).toBeVisible({ timeout: 5000 })
  await tapMobileSubjectRow(page, 'Geography')
  await expect(page.locator('h2:has-text("Geography")')).toBeVisible({ timeout: 5000 })

  // Go back to CS to configure it
  await page.getByTestId('mobile-config-back-button').click()
  await tapMobileSubjectRow(page, 'Computer Science')
  await expect(page.locator('h2:has-text("Computer Science")')).toBeVisible({ timeout: 5000 })

  // Set confidence → CS is now configured, but Geography is not
  await page.getByRole('button', { name: 'Set confidence to 3' }).click()

  // Footer should show "Next subject" (amber)
  const footer = page.getByTestId('mobile-config-footer-cta')
  await expect(footer).toContainText('Next subject')

  // Tapping advances to Geography
  await footer.click()
  await expect(page.locator('h2:has-text("Geography")')).toBeVisible({ timeout: 5000 })
})

// ═══════════════════════════════════════════════════════════════════
// 9. MOBILE CONFIG FOOTER: "Back to subjects" WHEN ALL CONFIGURED
// ═══════════════════════════════════════════════════════════════════

test('M9. Config footer "Back to subjects" when all subjects configured', async ({ page }) => {
  await freshGcsePicker(page)

  // Select and configure CS (single offering, just needs confidence)
  await tapMobileSubjectRow(page, 'Computer Science')
  await expect(page.locator('h2:has-text("Computer Science")')).toBeVisible({ timeout: 5000 })
  await page.getByRole('button', { name: 'Set confidence to 3' }).click()

  // Only one subject selected and it's configured → footer shows "Back to subjects"
  const footer = page.getByTestId('mobile-config-footer-cta')
  await expect(footer).toContainText('Back to subjects')

  // Tapping returns to picker
  await footer.click()
  await expect(page.locator('text=Pick your subjects')).toBeVisible({ timeout: 5000 })
})

// ═══════════════════════════════════════════════════════════════════
// 10. MOBILE FOOTER DISABLED WHEN NOTHING SELECTED
// ═══════════════════════════════════════════════════════════════════

test('M10. Footer CTA disabled when no subjects selected', async ({ page }) => {
  await freshGcsePicker(page)

  const footer = page.getByTestId('mobile-footer-cta')
  await expect(footer).toBeDisabled()
  await expect(footer).toContainText('Pick subjects')
})

// ═══════════════════════════════════════════════════════════════════
// 11. MOBILE ADD YOUR OWN SUBJECT OPENS WIZARD
// ═══════════════════════════════════════════════════════════════════

test('M11. Add your own subject opens wizard', async ({ page }) => {
  await freshGcsePicker(page)

  // Click the visible "+ Add your own subject" (mobile flow renders first in DOM)
  await page.getByTestId('add-own-subject').first().click()

  // Wizard overlay visible (create-subject mode)
  await expect(page.locator('text=Add a custom subject')).toBeVisible({ timeout: 5000 })
})
