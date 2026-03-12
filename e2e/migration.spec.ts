import { test, expect } from './helpers/base'
import { openAppWithState, readIdbState, expectE2EBridge, callE2EAction, readE2EState, extractNoteOrigins, extractSessionOrigins, extractPlanOrigins } from './helpers/seedAppState'
import { migrationMathsAqa, migrationMultiSubject, migrationWithCustomOffering } from './fixtures/migrationState'

const FROZEN_DATE = '2026-03-15'

// ── Helpers ──

/** Navigate to Edit Setup from Home, wait for heading */
async function goToEditSetup(page: import('@playwright/test').Page) {
  await page.locator('text=Edit setup').click()
  await expect(page.locator('text=Update your exam setup')).toBeVisible({ timeout: 5000 })
}

/** Expand a subject card in the Edit Setup desktop flow */
async function expandSubjectCard(page: import('@playwright/test').Page, subjectId: string) {
  await page.getByTestId(`subject-card-${subjectId}`).locator('[role="button"]').first().click()
}

/** Read IDB and return selectedOfferingIds array */
async function getPersistedOfferingIds(page: import('@playwright/test').Page): Promise<string[]> {
  const state = await readIdbState(page)
  return (state as Record<string, unknown>)?.selectedOfferingIds as string[] ?? []
}

// ═══════════════════════════════════════════════════════════════════
// 1. LOAD & ONBOARD
// ═══════════════════════════════════════════════════════════════════

test('1. Old Maths AQA user loads normally — onboarded, Maths visible', async ({ page }) => {
  await openAppWithState(page, migrationMathsAqa(), FROZEN_DATE)

  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  // Subject-scoped: Maths chip present on Home
  const mathsChip = page.getByTestId('subject-chip-maths')
  await expect(mathsChip).toBeVisible()
  await expect(mathsChip).toContainText('Maths')

  // Not re-onboarding
  await expect(page.locator('text=Get started')).not.toBeVisible()
  await expect(page.locator('text=Pick your subjects')).not.toBeVisible()
})

// ═══════════════════════════════════════════════════════════════════
// 2. BANNER VISIBILITY
// ═══════════════════════════════════════════════════════════════════

test('2. Tier confirmation banner for split subject, not for non-split', async ({ page }) => {
  await openAppWithState(page, migrationMultiSubject(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')

  // Maths banner visible, scoped to subject
  await expect(page.getByTestId('pending-tier-banner-maths')).toBeVisible({ timeout: 5000 })

  // Collapse Maths, expand CS
  await expandSubjectCard(page, 'maths')
  await expandSubjectCard(page, 'cs')

  // CS has no tier banner
  await expect(page.getByTestId('pending-tier-banner-cs')).not.toBeVisible()
})

// ═══════════════════════════════════════════════════════════════════
// 3. CONFIRM TIER — PRESERVES PROGRESS
// ═══════════════════════════════════════════════════════════════════

test('3. Confirming Higher preserves Maths and progress flows to Today', async ({ page }) => {
  await openAppWithState(page, migrationMathsAqa(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  await expect(page.getByTestId('pending-tier-banner-maths')).toBeVisible({ timeout: 5000 })

  // Pick Higher
  await page.getByTestId('offering-tile-maths-aqa-h').click()
  await page.getByRole('button', { name: 'Save changes' }).first().click()

  // Home: Maths chip still present
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible()

  // IDB: exactly maths-aqa-h persisted, no legacy or F
  const ids = await getPersistedOfferingIds(page)
  expect(ids).toContain('maths-aqa-h')
  expect(ids).not.toContain('maths-aqa-f')
  expect(ids).not.toContain('maths-aqa')

  // Today works
  await page.locator('text=Open today\'s plan').click()
  await expect(page.locator('text=Edit subjects')).toBeVisible({ timeout: 5000 })
})

// ═══════════════════════════════════════════════════════════════════
// 4. LEAVE WITHOUT CONFIRMING — COMPAT STATE PRESERVED
// ═══════════════════════════════════════════════════════════════════

test('4. Leaving Edit without confirming preserves pending state across refresh', async ({ page }) => {
  await openAppWithState(page, migrationMathsAqa(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  // Open Edit, see banner, navigate away
  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  await expect(page.getByTestId('pending-tier-banner-maths')).toBeVisible({ timeout: 5000 })
  await page.goto('/')
  await page.locator('text=Loading...').waitFor({ state: 'hidden', timeout: 10000 })

  // Maths still visible on Home
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })

  // Revisit Edit — banner still shows
  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  await expect(page.getByTestId('pending-tier-banner-maths')).toBeVisible({ timeout: 5000 })
})

// ═══════════════════════════════════════════════════════════════════
// 5. DISMISS PENDING SUBJECT
// ═══════════════════════════════════════════════════════════════════

test('5. Dismissing pending subject removes it from all surfaces', async ({ page }) => {
  await openAppWithState(page, migrationMathsAqa(), FROZEN_DATE)
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })

  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')

  // Deselect via "Not taking"
  await page.getByTestId('subject-card-maths').locator('button:has-text("Not taking")').click()
  await page.getByRole('button', { name: 'Save changes' }).first().click()

  // Home: Maths chip gone
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('subject-chip-maths')).not.toBeVisible({ timeout: 3000 })

  // IDB: no maths offerings
  const ids = await getPersistedOfferingIds(page)
  expect(ids.some(id => id.startsWith('maths-aqa'))).toBe(false)
})

// ═══════════════════════════════════════════════════════════════════
// 6. HOME — SUBJECT-SCOPED NEXT EXAM
// ═══════════════════════════════════════════════════════════════════

test('6. Home shows subject-scoped next exam for pending subject', async ({ page }) => {
  await openAppWithState(page, migrationMathsAqa(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  // The exam strip should reference Maths by subject name
  const examStrip = page.getByTestId('subject-next-exam-maths')
  await expect(examStrip).toBeVisible({ timeout: 3000 })
  await expect(examStrip).toContainText('Maths')
  // Should show a positive day count
  await expect(examStrip).toContainText('days')
})

// ═══════════════════════════════════════════════════════════════════
// 7. TODAY — PENDING SUBJECT HAS CONTENT
// ═══════════════════════════════════════════════════════════════════

test('7. Today plan renders for pending subject with Maths content', async ({ page }) => {
  await openAppWithState(page, migrationMathsAqa(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  await page.locator('text=Open today\'s plan').click()
  await expect(page.locator('text=Edit subjects')).toBeVisible({ timeout: 5000 })

  // Maths should appear somewhere in the Today plan content
  // (either in a plan item or in the scored topic list)
  await expect(page.locator('text=Maths')).toBeVisible({ timeout: 3000 })
})

// ═══════════════════════════════════════════════════════════════════
// 8. PROGRESS — PENDING SUBJECT RENDERS
// ═══════════════════════════════════════════════════════════════════

test('8. Progress tab renders migrated subject row for pending Maths', async ({ page }) => {
  await openAppWithState(page, migrationMathsAqa(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  await page.getByRole('button', { name: 'View progress' }).click()
  await expect(page.locator('[data-testid="progress-hero"]')).toBeVisible({ timeout: 5000 })

  // Subject-scoped: progress row for maths exists (may have 2 in pending state due to F+H)
  const mathsRow = page.getByTestId('progress-subject-row-maths').first()
  await expect(mathsRow).toBeVisible()
  await expect(mathsRow).toContainText('Maths')
})

// ═══════════════════════════════════════════════════════════════════
// 9. CONFIRM FOUNDATION → SWITCH TO HIGHER VIA EDIT
// ═══════════════════════════════════════════════════════════════════

test('9. Post-confirm tier switch: Foundation → Higher via Edit', async ({ page }) => {
  await openAppWithState(page, migrationMathsAqa(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  // Confirm Foundation
  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  await page.getByTestId('offering-tile-maths-aqa-f').click()
  await page.getByRole('button', { name: 'Save changes' }).first().click()
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })

  // IDB check: Foundation selected
  let ids = await getPersistedOfferingIds(page)
  expect(ids).toContain('maths-aqa-f')

  // Now switch to Higher
  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  // No pending banner — already confirmed
  await expect(page.getByTestId('pending-tier-banner-maths')).not.toBeVisible({ timeout: 2000 })
  await page.getByTestId('offering-tile-maths-aqa-h').click()
  await page.getByRole('button', { name: 'Save changes' }).first().click()

  // Home: still has Maths
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })

  // IDB: exactly Higher, no Foundation
  ids = await getPersistedOfferingIds(page)
  expect(ids).toContain('maths-aqa-h')
  expect(ids).not.toContain('maths-aqa-f')
  expect(ids).not.toContain('maths-aqa')
})

// ═══════════════════════════════════════════════════════════════════
// 10. MULTI-SUBJECT: CONFIRM ONE, LEAVE OTHER PENDING
// ═══════════════════════════════════════════════════════════════════

test('10. Confirming Maths leaves Biology pending', async ({ page }) => {
  await openAppWithState(page, migrationMultiSubject(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  await page.getByTestId('offering-tile-maths-aqa-h').click()
  await expandSubjectCard(page, 'maths') // collapse

  // Save without touching Bio
  await page.getByRole('button', { name: 'Save changes' }).first().click()

  // Home: both Maths and Biology visible
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('subject-chip-biology')).toBeVisible()

  // Revisit Edit: Bio still has banner
  await goToEditSetup(page)
  await expandSubjectCard(page, 'bio')
  await expect(page.getByTestId('pending-tier-banner-bio')).toBeVisible({ timeout: 5000 })
})

// ═══════════════════════════════════════════════════════════════════
// 11. CUSTOM OFFERING SURVIVES MIGRATION
// ═══════════════════════════════════════════════════════════════════

test('11. Custom offering survives migration alongside tier-split subject', async ({ page }) => {
  await openAppWithState(page, migrationWithCustomOffering(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })

  // Both Maths (migrated) and Art (custom) should be visible
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible()
  await expect(page.getByTestId('subject-chip-art')).toBeVisible()

  // IDB: custom-offering-1 persisted alongside tier offerings
  const ids = await getPersistedOfferingIds(page)
  expect(ids).toContain('custom-offering-1')

  // Confirm maths tier — custom offering should remain
  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  await page.getByTestId('offering-tile-maths-aqa-h').click()
  await page.getByRole('button', { name: 'Save changes' }).first().click()

  // Home: both subjects still visible
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })
  await expect(page.getByTestId('subject-chip-art')).toBeVisible()

  // IDB: custom-offering-1 still there
  const idsAfter = await getPersistedOfferingIds(page)
  expect(idsAfter).toContain('custom-offering-1')
  expect(idsAfter).toContain('maths-aqa-h')
})

// ═══════════════════════════════════════════════════════════════════
// 12. NEW NOTE WHILE PENDING — SURVIVES HIGHER CONFIRMATION
// ═══════════════════════════════════════════════════════════════════

test('12. Note created via E2E bridge while pending survives Higher confirmation', async ({ page }) => {
  await openAppWithState(page, migrationMathsAqa(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })
  await expectE2EBridge(page)

  // Find a Maths Higher topic ID from the live store (after migration)
  const stateBefore = await readE2EState(page)
  const mathsHTopics = stateBefore.topics.filter(t => t.offeringId === 'maths-aqa-h')
  expect(mathsHTopics.length).toBeGreaterThan(0)
  const targetTopicId = mathsHTopics[0].id

  // Create a note via E2E bridge — this triggers resolveCompatWriteTargets and mirrors to both tiers
  const noteText = 'E2E pending note: quadratics trick'
  await callE2EAction(page, 'addNote', targetTopicId, noteText)

  // Verify the note exists (mirrored to both tiers while pending)
  const stateWithNote = await readE2EState(page)
  const pendingNotes = stateWithNote.notes.filter(n => n.text === noteText)
  // Should be mirrored (2 copies) since subject is pending
  expect(pendingNotes.length).toBe(2)
  // But only 1 logical origin
  const noteOrigins = extractNoteOrigins(pendingNotes)
  expect(noteOrigins.size).toBe(1)

  // Confirm Higher via UI
  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  await page.getByTestId('offering-tile-maths-aqa-h').click()
  await page.getByRole('button', { name: 'Save changes' }).first().click()
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })

  // After confirmation: exactly 1 copy of the note survives (Higher only, Foundation sibling deleted)
  const stateAfter = await readE2EState(page)
  const survivingNotes = stateAfter.notes.filter(n => n.text === noteText)
  expect(survivingNotes.length).toBe(1)
  // The surviving note targets a Higher topic
  const survivingTopic = stateAfter.topics.find(t => t.id === survivingNotes[0].topicId)
  expect(survivingTopic?.offeringId).toBe('maths-aqa-h')

  // IDB persisted correctly
  expect(stateAfter.selectedOfferingIds).toContain('maths-aqa-h')
  expect(stateAfter.selectedOfferingIds).not.toContain('maths-aqa-f')
})

// ═══════════════════════════════════════════════════════════════════
// 13. NEW SESSION WHILE PENDING — SURVIVES HIGHER CONFIRMATION
// ═══════════════════════════════════════════════════════════════════

test('13. Session logged via E2E bridge while pending survives Higher confirmation', async ({ page }) => {
  await openAppWithState(page, migrationMathsAqa(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })
  await expectE2EBridge(page)

  // Find a Higher topic ID
  const stateBefore = await readE2EState(page)
  const mathsHTopics = stateBefore.topics.filter(t => t.offeringId === 'maths-aqa-h')
  const targetTopicId = mathsHTopics[0].id
  const sessionsBefore = stateBefore.sessions.length

  // Log a session via E2E bridge
  await callE2EAction(page, 'logSession', targetTopicId, 75)

  // Verify mirrored (2 raw session records, 1 logical origin)
  const stateWithSession = await readE2EState(page)
  const newSessions = stateWithSession.sessions.slice(sessionsBefore)
  expect(newSessions.length).toBe(2)
  const sessionOrigins = extractSessionOrigins(newSessions)
  expect(sessionOrigins.size).toBe(1)

  // Confirm Higher
  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  await page.getByTestId('offering-tile-maths-aqa-h').click()
  await page.getByRole('button', { name: 'Save changes' }).first().click()
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })

  // After confirmation: exactly 1 surviving session for the created origin, on a Higher topic
  const stateAfter = await readE2EState(page)
  const createdOrigin = [...sessionOrigins][0]
  const surviving = stateAfter.sessions.filter(s => {
    const idx = s.id.indexOf('-migrated-')
    const origin = idx >= 0 ? s.id.slice(0, idx) : s.id
    return origin === createdOrigin
  })
  expect(surviving).toHaveLength(1)
  const survivingTopic = stateAfter.topics.find(t => t.id === surviving[0].topicId)
  expect(survivingTopic?.offeringId).toBe('maths-aqa-h')
})

// ═══════════════════════════════════════════════════════════════════
// 14. EDIT MIRRORED NOTE WHILE PENDING — EDIT SURVIVES CONFIRMATION
// ═══════════════════════════════════════════════════════════════════

test('14. Note edited while pending: edited text survives Higher confirmation exactly once', async ({ page }) => {
  await openAppWithState(page, migrationMathsAqa(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })
  await expectE2EBridge(page)

  // Find a Higher topic ID
  const stateBefore = await readE2EState(page)
  const mathsHTopics = stateBefore.topics.filter(t => t.offeringId === 'maths-aqa-h')
  const targetTopicId = mathsHTopics[0].id

  // Create a note via bridge
  const originalText = 'E2E original note text'
  await callE2EAction(page, 'addNote', targetTopicId, originalText)

  // Get the note ID (either copy works — siblings resolved automatically)
  const stateWithNote = await readE2EState(page)
  const createdNote = stateWithNote.notes.find(n => n.text === originalText)!
  expect(createdNote).toBeTruthy()

  // Edit the note
  const editedText = 'E2E EDITED note text'
  await callE2EAction(page, 'updateNoteById', createdNote.id, editedText)

  // Both copies should have the edited text
  const stateEdited = await readE2EState(page)
  const editedNotes = stateEdited.notes.filter(n => n.text === editedText)
  expect(editedNotes.length).toBe(2)
  // Original text is gone
  expect(stateEdited.notes.filter(n => n.text === originalText).length).toBe(0)

  // Confirm Higher
  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  await page.getByTestId('offering-tile-maths-aqa-h').click()
  await page.getByRole('button', { name: 'Save changes' }).first().click()
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })

  // Exactly 1 copy with edited text survives
  const stateAfter = await readE2EState(page)
  const survivingEdited = stateAfter.notes.filter(n => n.text === editedText)
  expect(survivingEdited.length).toBe(1)
  const survivingTopic = stateAfter.topics.find(t => t.id === survivingEdited[0].topicId)
  expect(survivingTopic?.offeringId).toBe('maths-aqa-h')
})

// ═══════════════════════════════════════════════════════════════════
// 15. DELETE MIRRORED NOTE WHILE PENDING — NO RESURRECTION
// ═══════════════════════════════════════════════════════════════════

test('15. Note deleted while pending does not resurrect after Higher confirmation', async ({ page }) => {
  await openAppWithState(page, migrationMathsAqa(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })
  await expectE2EBridge(page)

  // Find a Higher topic ID
  const stateBefore = await readE2EState(page)
  const mathsHTopics = stateBefore.topics.filter(t => t.offeringId === 'maths-aqa-h')
  const targetTopicId = mathsHTopics[0].id

  // Create a note
  const noteText = 'E2E note to be deleted'
  await callE2EAction(page, 'addNote', targetTopicId, noteText)

  // Verify it exists (mirrored)
  const stateWithNote = await readE2EState(page)
  const createdNotes = stateWithNote.notes.filter(n => n.text === noteText)
  expect(createdNotes.length).toBe(2)

  // Delete via bridge (removes both siblings)
  await callE2EAction(page, 'removeNoteById', createdNotes[0].id)

  // Verify both copies gone
  const stateDeleted = await readE2EState(page)
  expect(stateDeleted.notes.filter(n => n.text === noteText).length).toBe(0)

  // Confirm Higher via bridge (this test validates note deletion, not UI flow)
  await callE2EAction(page, 'confirmTierSelection', 'maths', 'maths-aqa-h')

  // Deleted note does not resurrect
  const stateAfter = await readE2EState(page)
  expect(stateAfter.notes.filter(n => n.text === noteText).length).toBe(0)
  expect(stateAfter.selectedOfferingIds).toContain('maths-aqa-h')
})

// ═══════════════════════════════════════════════════════════════════
// 16. REPEATED SWITCH F→H→F→H — ORIGIN-IDENTITY INVARIANT
// ═══════════════════════════════════════════════════════════════════

test('16. Repeated tier switch F→H→F→H with interleaved work: exact origin stability', async ({ page }) => {
  await openAppWithState(page, migrationMathsAqa(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })
  await expectE2EBridge(page)

  // Confirm Foundation
  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  await page.getByTestId('offering-tile-maths-aqa-f').click()
  await page.getByRole('button', { name: 'Save changes' }).first().click()
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })

  // Create note A + session A + plan item A on Foundation topic
  const stateAfterF = await readE2EState(page)
  const mathsFTopics = stateAfterF.topics.filter(t => t.offeringId === 'maths-aqa-f')
  expect(mathsFTopics.length).toBeGreaterThan(0)
  await callE2EAction(page, 'addNote', mathsFTopics[0].id, 'Note A on Foundation')
  await callE2EAction(page, 'logSession', mathsFTopics[0].id, 70)
  await callE2EAction(page, 'addToPlan', mathsFTopics[0].id, 'manual')

  // Switch to Higher
  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  await page.getByTestId('offering-tile-maths-aqa-h').click()
  await page.getByRole('button', { name: 'Save changes' }).first().click()
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })

  // Create note B + session B + plan item B on Higher topic
  const stateAfterH = await readE2EState(page)
  const mathsHTopics = stateAfterH.topics.filter(t => t.offeringId === 'maths-aqa-h')
  expect(mathsHTopics.length).toBeGreaterThan(0)
  await callE2EAction(page, 'addNote', mathsHTopics[0].id, 'Note B on Higher')
  await callE2EAction(page, 'logSession', mathsHTopics[0].id, 85)
  await callE2EAction(page, 'addToPlan', mathsHTopics[1].id, 'manual')

  // Snapshot after H + note B (this is the canonical set: baseline + A + B)
  const stateWithNoteB = await readE2EState(page)
  const originsAfterNoteB = {
    sessions: [...extractSessionOrigins(stateWithNoteB.sessions)].sort(),
    notes: [...extractNoteOrigins(stateWithNoteB.notes)].sort(),
    plans: [...extractPlanOrigins(stateWithNoteB.dailyPlan)].sort(),
  }

  // Switch back to Foundation
  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  await page.getByTestId('offering-tile-maths-aqa-f').click()
  await page.getByRole('button', { name: 'Save changes' }).first().click()
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })

  // Switch to Higher again (F→H→F→H complete)
  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  await page.getByTestId('offering-tile-maths-aqa-h').click()
  await page.getByRole('button', { name: 'Save changes' }).first().click()
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })

  // Final state
  const stateFinal = await readE2EState(page)

  // IDB: exactly one maths offering
  const mathsIds = stateFinal.selectedOfferingIds.filter(id => id.startsWith('maths-aqa'))
  expect(mathsIds).toHaveLength(1)
  expect(mathsIds[0]).toBe('maths-aqa-h')

  // Exact origin-set equality: baseline + note A + note B — no duplication, no loss
  const originsFinal = {
    sessions: [...extractSessionOrigins(stateFinal.sessions)].sort(),
    notes: [...extractNoteOrigins(stateFinal.notes)].sort(),
    plans: [...extractPlanOrigins(stateFinal.dailyPlan)].sort(),
  }

  expect(originsFinal.sessions).toEqual(originsAfterNoteB.sessions)
  expect(originsFinal.notes).toEqual(originsAfterNoteB.notes)
  expect(originsFinal.plans).toEqual(originsAfterNoteB.plans)

  // Both notes still findable by text
  const finalNoteTexts = stateFinal.notes.map(n => n.text)
  expect(finalNoteTexts).toContain('Note A on Foundation')
  expect(finalNoteTexts).toContain('Note B on Higher')
})

// ═══════════════════════════════════════════════════════════════════
// 17. SAME-SESSION DISMISS AND RE-ADD
// ═══════════════════════════════════════════════════════════════════

test('17. Dismiss then re-add in same session restores pending banner', async ({ page }) => {
  await openAppWithState(page, migrationMathsAqa(), FROZEN_DATE)
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })

  // Dismiss Maths
  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  await page.getByTestId('subject-card-maths').locator('button:has-text("Not taking")').click()

  // Re-add Maths immediately (without saving first)
  await page.getByTestId('subject-card-maths').locator('button:has-text("Yes, I take this")').click()

  // The pending tier banner should re-appear for maths
  await expect(page.getByTestId('pending-tier-banner-maths')).toBeVisible({ timeout: 5000 })

  // Confirm Higher and save
  await page.getByTestId('offering-tile-maths-aqa-h').click()
  await page.getByRole('button', { name: 'Save changes' }).first().click()

  // Home: Maths visible
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })

  // IDB: maths-aqa-h persisted
  const ids = await getPersistedOfferingIds(page)
  expect(ids).toContain('maths-aqa-h')
})

// ═══════════════════════════════════════════════════════════════════
// 18. PLAN ITEM MIRRORED WHILE PENDING — SURVIVES CONFIRMATION
// ═══════════════════════════════════════════════════════════════════

test('18. Plan item added while pending is mirrored and survives Higher confirmation', async ({ page }) => {
  await openAppWithState(page, migrationMathsAqa(), FROZEN_DATE)
  await expect(page.locator('text=Your subjects')).toBeVisible({ timeout: 5000 })
  await expectE2EBridge(page)

  // Find a Higher topic ID
  const stateBefore = await readE2EState(page)
  const mathsHTopics = stateBefore.topics.filter(t => t.offeringId === 'maths-aqa-h')
  expect(mathsHTopics.length).toBeGreaterThan(0)
  const targetTopicId = mathsHTopics[0].id

  // Add plan item via bridge
  await callE2EAction(page, 'addToPlan', targetTopicId, 'manual')

  // Verify mirrored (2 raw plan items, 1 logical origin)
  const stateWithPlan = await readE2EState(page)
  const getOrigin = (id: string) => { const idx = id.indexOf('-migrated-'); return idx >= 0 ? id.slice(0, idx) : id }
  // Find items sharing an origin with any item targeting our topic
  const targetOrigins = new Set(stateWithPlan.dailyPlan.filter(i => i.topicId === targetTopicId).map(i => getOrigin(i.id)))
  const newItems = stateWithPlan.dailyPlan.filter(i => targetOrigins.has(getOrigin(i.id)))
  const planOrigins = extractPlanOrigins(newItems)
  expect(planOrigins.size).toBe(1)
  expect(newItems.length).toBe(2) // mirrored to both tiers

  // Confirm Higher
  await goToEditSetup(page)
  await expandSubjectCard(page, 'maths')
  await page.getByTestId('offering-tile-maths-aqa-h').click()
  await page.getByRole('button', { name: 'Save changes' }).first().click()
  await expect(page.getByTestId('subject-chip-maths')).toBeVisible({ timeout: 5000 })

  // After confirmation: exactly 1 surviving plan item for the created origin
  const stateAfter = await readE2EState(page)
  const createdOrigin = [...planOrigins][0]
  const surviving = stateAfter.dailyPlan.filter(i => {
    const idx = i.id.indexOf('-migrated-')
    const origin = idx >= 0 ? i.id.slice(0, idx) : i.id
    return origin === createdOrigin
  })
  expect(surviving).toHaveLength(1)
  const survivingTopic = stateAfter.topics.find(t => t.id === surviving[0].topicId)
  expect(survivingTopic?.offeringId).toBe('maths-aqa-h')
})
