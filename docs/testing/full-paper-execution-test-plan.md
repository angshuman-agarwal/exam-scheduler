# Full Paper Execution Test Plan

## Launch the App
npm run dev

## load json via ChromeDeveloper Tools MCP into INDEXEDDB
Refer to [/Users/jimmy/code/exam-scheduler/docs/testing/integration-test-seed.json](/Users/jimmy/code/exam-scheduler/docs/testing/integration-test-seed.json) for IndexedDB seeding. Use this internal testing seed unless you need a separate scenario that cannot be represented with it.




## Purpose

- Validate full-paper behavior end to end without guessing.
- Give QA, product, and engineering one executable checklist.
- Cover first-run setup, launch paths, multi-paper selection, timer flow, progress surfaces, data integrity, and manual IndexedDB edge-case setup.
- Be explicit about what is implemented, what is intentionally out of scope, and where the current product still has limitations.

## Scope

- Included:
  - Full-paper launch and completion flows
  - Single-paper vs multi-paper subject behavior
  - Multi-paper chooser on the pre-start screen
  - Confidence, marks, notes, and grouped progress behavior
  - Progress cards, study velocity, and mixed topic/full-paper breakdown rows
  - IndexedDB manual mutation for edge cases
- Excluded:
  - A subject-card split button
  - Rich paper mistake review workflow
  - Editing a saved paper attempt after submission

## Brutally Honest Current Product Truths

- Generic subject-card `Full paper` is no longer a silent “start the nearest paper” action for multi-paper subjects.
- For multi-paper subjects launched from the generic subject card, the paper pre-start screen auto-selects the nearest upcoming paper.
- `Browse topics instead` stays enabled on the pre-start screen.
- For single-paper subjects, behavior should be unchanged.
- `Add topics to plan` subject cards now expose two clearer modes on the collapsed card:
  - `Full paper`
  - `N topics / Topic practice`
- Explicit paper launches are still explicit:
  - calendar paper action
  - Today `Full paper practice`
  - paper-scoped browse / picker
- Progress currently stores every real `PaperAttempt`, but the breakdown UI groups same-paper same-day attempts into one display row.
- The Progress breakdown still uses the `Topic Mastery` title even though it now mixes topics and full papers.
- Saved notes in Progress no longer render as inline preview text:
  - topic and paper rows show a `Notes` pill only when a note exists
  - clicking it opens a popup overlay
  - multiline notes should preserve line breaks
  - paper-note popups can also show tagged weak topics as chips
- The current Progress top-card set is:
  - `Daily Streak`
  - `Total Studied`
  - `Papers Attempted`
  - `Last Session`
  - `Study Velocity`
- The Playwright `webServer` config in this repo currently has a known preview/build chain issue. Browser specs are still valid, but may need a manually started preview server in local execution.

## Test Environments

- Recommended browser: latest Chrome
- Recommended viewport:
  - Desktop: `1280 x 900`
  - Mobile sanity check: Chrome device toolbar `390 x 844`
- Recommended data reset before each scenario:
  - Use the app’s `Reset all data` if the scenario does not require preserved history.
  - For precise edge cases, use the IndexedDB snippets in this document.

## Pre-Flight Checklist

- Confirm app loads without `Loading...` hanging.
- Confirm no console crash on `#today` or `#progress`.
- Confirm service worker is not serving stale assets after a code update.
- Confirm current date assumptions if testing date-sensitive scenarios.

## Stable Seed Facts From Current Catalog

- `Computer Science (AQA 8525)` has:
  - `Paper 1`
  - `Paper 2`
- `Biology (AQA 8461)` has:
  - `Paper 1`
  - `Paper 2`
- `Geography (AQA 8035)` has:
  - `Paper 1`
  - `Paper 2`
  - `Paper 3`
- Example single-paper subjects in the seed are useful for “no extra chooser” validation.
  - Verify the actual selected subject before using it as the single-paper baseline.

## IndexedDB / DevTools Setup

### Open the persisted app state

1. Open Chrome DevTools via the Chrome Dev Tools MCP.
2. Go to `Application`.
3. Go to `IndexedDB`.
4. Open database `gcse-scheduler`.
5. Open object store `state`.
6. Inspect key `app`.

### Read the current app state from console

```js
await new Promise((resolve, reject) => {
  const req = indexedDB.open('gcse-scheduler', 2)
  req.onsuccess = () => {
    const db = req.result
    const tx = db.transaction('state', 'readonly')
    const getReq = tx.objectStore('state').get('app')
    getReq.onsuccess = () => { console.log(getReq.result); db.close(); resolve() }
    getReq.onerror = () => { db.close(); reject(getReq.error) }
  }
  req.onerror = () => reject(req.error)
})
```

### Write back a modified app state

```js
async function updateAppState(mutator) {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('gcse-scheduler', 2)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  const current = await new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly')
    const getReq = tx.objectStore('state').get('app')
    getReq.onsuccess = () => resolve(getReq.result)
    getReq.onerror = () => reject(getReq.error)
  })

  const next = structuredClone(current)
  mutator(next)

  await new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite')
    tx.objectStore('state').put(next, 'app')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  db.close()
  location.reload()
}
```

### Seed the full top-level JSON you already have into `app`

Use this when your source of truth is a complete exported app JSON, not an incremental mutation.

```js
async function seedFullAppJson(fullAppState) {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('gcse-scheduler', 2)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  await new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite')
    const store = tx.objectStore('state')
    store.put(structuredClone(fullAppState), 'app')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  db.close()
  location.reload()
}
```

Usage:

```js
// paste your provided full JSON object here
const SEEDED_APP_JSON = {/* your full app JSON */}
await seedFullAppJson(SEEDED_APP_JSON)
```

### Seed a timer JSON separately into `timer`

Use this only when the scenario explicitly requires a live, paused, stopped, interrupted, or orphaned timer record.

```js
async function seedTimerJson(timerState) {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('gcse-scheduler', 2)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  await new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite')
    const store = tx.objectStore('state')
    store.put(structuredClone(timerState), 'timer')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  db.close()
  location.reload()
}
```

Usage:

```js
const TIMER_JSON = {
  session: {
    sessionId: 'manual-seeded-paper',
    targetType: 'paper',
    targetId: 'geo-p1',
    source: 'picker',
    mode: 'paused',
    startedAt: Date.now() - 30000,
    pausedAt: Date.now() - 5000,
    pausedAccumMs: 0,
    hiddenAt: null,
    strictMode: false,
    modeChangedAt: Date.now() - 5000,
  },
  settings: {
    strictModeDefault: false,
    wakeLockEnabled: true,
  },
}

await seedTimerJson(TIMER_JSON)
```

### Cold-start verification rule after JSON seeding

Use this after every top-level JSON import or timer import.

1. Seed `app` and, if needed, `timer`.
2. Reload the page.
3. Wait for `Loading...` to disappear completely.
4. Open the intended route fresh:
   - `/#today` for planner/timer flows
   - `/#progress` for progress scenarios
5. Only then start assertions.

This matters because many regressions are bootstrap-only and will not reproduce correctly on a live-mutated page.

### Select only one offering

```js
updateAppState((app) => {
  app.selectedOfferingIds = ['geo-aqa']
})
```

### Force one paper past and later papers future

```js
updateAppState((app) => {
  app.papers = app.papers.map((paper) => {
    if (paper.id === 'geo-p1') return { ...paper, examDate: '2026-04-01' }
    if (paper.id === 'geo-p2') return { ...paper, examDate: '2026-05-20' }
    if (paper.id === 'geo-p3') return { ...paper, examDate: '2026-05-28' }
    return paper
  })
})
```

### Seed repeated same-day paper attempts

```js
updateAppState((app) => {
  app.paperAttempts = [
    {
      id: 'geo-paper-attempt-1',
      paperId: 'geo-p1',
      date: '2026-04-15',
      timestamp: new Date('2026-04-15T10:00:00').getTime(),
      durationSeconds: 3600,
      confidence: 2,
      rawMark: 38,
      totalMarks: 80,
      noteText: 'Morning attempt',
      taggedTopicIds: [],
      source: 'picker',
    },
    {
      id: 'geo-paper-attempt-2',
      paperId: 'geo-p1',
      date: '2026-04-15',
      timestamp: new Date('2026-04-15T18:00:00').getTime(),
      durationSeconds: 3900,
      confidence: 4,
      rawMark: 62,
      totalMarks: 80,
      noteText: 'Evening attempt',
      taggedTopicIds: [],
      source: 'calendar',
    },
  ]
})
```

### Clear paper attempts only

```js
updateAppState((app) => {
  app.paperAttempts = []
})
```

## Section A. First-Run And Catalog Integrity

### A1. Fresh first run honors selected subjects and paper scheme

- Setup:
  - Reset all data.
  - Complete onboarding with `Geography`.
- Steps:
  - Open `Today`.
  - Find the `Geography` card under `Add topics to plan`.
  - Read the metadata line.
- Expected:
  - The card shows all Geography papers, not just one.
  - Each paper shows its own countdown.
  - Example pattern:
    - `Paper 1 Exam in X days`
    - `Paper 2 Exam in Y days`
    - `Paper 3 Exam in Z days`
  - The card still shows a single subject row, not three separate subject rows.
  - The collapsed card shows:
    - a compact `Full paper` chip
    - a separate `N topics` / `Topic practice` expander control

### A2. Expanded subject list is exhaustive across papers

- Setup:
  - Use `Geography` selected.
- Steps:
  - Expand the `Geography` card.
  - Count or scan the topics.
- Expected:
  - Topics from all Geography papers are present in the expanded list.
  - They are not currently grouped visually by paper.
  - This is a current product limitation, not a data loss bug.

### A3. When the nearest paper passes, the next remaining paper becomes the primary paper

- Setup:
  - Use the IndexedDB snippet to move `geo-p1` into the past and keep `geo-p2` / `geo-p3` in the future.
- Steps:
  - Reload `Today`.
  - Find the `Geography` subject card.
  - Click `Full paper for Geography`.
- Expected:
  - The subject card still lists all papers in the subtitle.
  - The generic subject-card launch enters the multi-paper chooser flow.
  - The nearest remaining upcoming paper should be preselected.
  - Remaining papers must still be visible and selectable.

### A4. Header utility controls remain obvious and separated by intent

- Setup:
  - Open `Today`.
- Steps:
  - Look at the Study Planner header.
- Expected:
  - `Edit subjects` appears as a clear blue-tinted utility chip, not detached gray text.
  - `Crunch mode` appears as a separate warm utility chip when active.
  - Neither header control visually competes with the main page CTAs lower on the screen.

### A4.1. Mobile `Edit subjects` back returns safely to Today

- Setup:
  - Open `Today` on a narrow mobile viewport.
- Steps:
  - Tap `Edit subjects`.
  - Wait for `Update your subjects`.
  - Tap the header back arrow.
- Expected:
  - The edit-subjects overlay closes.
  - User returns to `Study Planner`.
  - No onboarding or edit state remains stuck on screen.

### A5. Full JSON seed cold-start sanity check

- Setup:
  - Seed your provided top-level app JSON into the `app` key.
- Steps:
  - Reload the app.
  - Wait for `Loading...` to disappear.
  - Open `/#today`.
  - Open `/#progress`.
- Expected:
  - App hydrates without crash.
  - Selected offerings from the seeded JSON are honored.
  - Seeded papers, topics, sessions, and paper attempts appear on first cold load.
  - No hidden dependency on in-memory state exists.

## Section B. Launch Path Matrix

### B1. Generic subject-card launch for a multi-paper subject

- Setup:
  - Select `Computer Science` or `Geography`.
- Steps:
  - On `Today`, locate the subject row in `Add topics to plan`.
  - Click `Full paper`.
- Expected:
  - User lands on the full-paper pre-start screen.
  - If the subject has multiple papers:
    - a mutually exclusive paper choice UI is visible
    - the nearest upcoming paper is preselected
    - each pill shows the paper name and a short exam date
    - `Start full paper` is enabled
    - `Browse topics instead` is enabled
    - helper copy reflects the preselected paper

### B2. Select a paper in the multi-paper chooser

- Setup:
  - Continue from `B1`.
- Steps:
  - Click `Paper 2`.
- Expected:
  - Header updates to `Subject — Paper 2`.
  - Date/meta line updates to the selected paper.
  - `Start full paper` targets the selected paper.
  - `Browse topics instead` routes to the selected paper.

### B3. Single-paper subject launch must remain unchanged

- Setup:
  - Use a selected subject with one paper only.
- Steps:
  - Open `Today`.
  - Click the subject-card `Full paper`.
- Expected:
  - No chooser appears.
  - `Start full paper` is enabled immediately.
  - `Browse topics instead` is enabled immediately.
  - This flow should feel identical to the older single-paper experience.

### B4. Calendar explicit paper launch remains explicit

- Setup:
  - Use `Computer Science`.
- Steps:
  - Open the `Exam Calendar`.
  - Click the exam day for `Paper 1`.
  - In the day panel, click `Start full paper`.
- Expected:
  - User lands on the paper-scoped screen for that exact paper.
  - The chosen paper is already scoped.
  - `Start full paper` is enabled immediately.
  - No forced paper chooser appears for this explicit route.

### B5. Today `Full paper practice` explicit paper launch remains explicit

- Setup:
  - Move a selected paper to within `21` days if needed using IndexedDB.
- Steps:
  - Open `Today`.
  - In `Full paper practice`, click `Start full paper`.
- Expected:
  - The paper is already explicit.
  - No additional paper choice is required.
  - The launch remains one click to the paper pre-start UI.

### B6. Paper-scoped browse launch remains explicit

- Setup:
  - Open a paper-specific browse route from calendar `Browse topics` or another paper-scoped entry.
- Steps:
  - In the paper-scoped picker, click `Start full paper`.
- Expected:
  - The chosen paper remains preselected.
  - No additional choice is required.

### B7. `Browse topics instead` from multi-paper chooser

- Setup:
  - Use generic subject-card launch for a multi-paper subject.
  - Select `Paper 2`.
- Steps:
  - Click `Browse topics instead`.
- Expected:
  - The browse destination is scoped to `Paper 2`, not to the original default paper.
  - The visible heading and topic list should match `Paper 2`.

## Section C. Multi-Paper Chooser UX

### C1. Visual behavior

- Expected:
  - Only one paper pill/button can be selected at a time.
  - Selected state is visually obvious.
  - Unselected states remain visible and tappable.
  - The choice area should not visually dominate the page more than the primary CTA.

### C2. Disabled state before selection

- Expected:
  - This state should no longer exist for generic multi-paper launches.
  - The nearest upcoming paper is preselected automatically.
  - If any disabled paper-start CTA is ever shown elsewhere, it must look intentionally inactive and not retain the active blue treatment.

### C3. Choice state lock after timer starts

- Setup:
  - Choose a paper.
  - Click `Start full paper`.
- Steps:
  - Observe whether the chooser is still visible.
- Expected:
  - Choice should no longer be meaningfully editable once the session is active.
  - User must not be able to change paper mid-session and create a mismatched timer target.

### C4. Back navigation from chooser

- Setup:
  - Generic multi-paper subject-card launch.
- Steps:
  - Click `Back`.
- Expected:
  - Returns safely to `Today`.
  - No active timer is created.
  - No `PaperAttempt` is logged.

### C5. Generic chooser default should be trustworthy

- Setup:
  - Generic multi-paper subject-card launch.
- Steps:
  - Open the chooser and do not change the selected pill.
- Expected:
  - The preselected paper is the nearest upcoming paper, not always `Paper 1`.
  - The paper date shown on the selected pill explains why it is the default.

## Section C6. Collapsed Subject Card UX Hierarchy

### C2.1. Full-paper CTA is visible but not dominant

- Setup:
  - Open `Today`.
- Steps:
  - Inspect any subject card in `Add topics to plan`.
- Expected:
  - The paper CTA is labeled `Full paper`.
  - It is a compact utility chip, not a large primary button.
  - It remains clearly clickable.
  - Subject name and paper countdowns remain the dominant content.

### C2.2. Topic expander explicitly communicates topic-based practice

- Setup:
  - Open `Today`.
- Steps:
  - Inspect the expander control on the right side of a subject card.
- Expected:
  - The control combines:
    - topic count
    - `Topic practice`
    - chevron
  - It does not look like passive metadata.
  - It clearly suggests “open this for topic-based study.”

### C2.3. Topic expander behavior remains unchanged

- Setup:
  - Open `Today`.
- Steps:
  - Click the `N topics / Topic practice` control.
  - Click it again.
- Expected:
  - First click expands the subject.
  - Second click collapses the subject.
  - No timer starts.
  - No paper flow opens.
  - Add/swap topic controls inside the expanded content still work as before.

### C2.4. Collapsed-card controls stay independent on mobile

- Setup:
  - Open `Today` on a narrow mobile viewport.
- Steps:
  - Tap `Full paper`.
  - Return to `Today`.
  - Tap `N topics / Topic practice`.
- Expected:
  - Tapping `Full paper` does not expand the subject card.
  - Tapping `Topic practice` does not launch paper flow.
  - The two controls remain visually and behaviorally distinct on mobile.

## Section D. Paper Timer And Submission

### D1. Start / pause / resume / finish

- Setup:
  - Any selected paper with an enabled start button.
- Steps:
  - Click `Start full paper`.
  - Wait a few seconds.
  - Click `Pause`.
  - Click `Resume`.
  - Click `Finish paper`.
- Expected:
  - Timer increments normally.
  - Pause freezes elapsed time.
  - Resume restarts elapsed time.
  - Finish opens review, not immediate save.

### D2. Strict mode threshold

- Setup:
  - Enable `Strict mode`.
- Steps:
  - Start paper.
  - Move focus away from the app longer than `60` seconds.
- Expected:
  - Paper session is interrupted.
  - Interrupted attempt is not counted.
  - UI clearly communicates that the attempt was not saved.

### D3. Screen wake behavior is automatic while a paper is running

- Steps:
  - Open the paper pre-start screen.
  - Inspect `Session preferences`.
  - Start paper.
- Expected:
  - `Keep screen awake` toggle is not shown anymore.
  - Wake lock is treated as automatic while the timer is running.
  - On supported devices/browsers, the running timer can show the `Screen awake` badge.

### D4. Review form validation

- Steps:
  - Finish a paper.
  - Leave confidence unset.
- Expected:
  - `Complete` remains disabled.
- Then:
  - Set confidence.
  - Leave marks empty.
- Expected:
  - Save is allowed.
  - Marks are optional in v1.

### D5. Marks and estimated percent summary

- Steps:
  - Enter `47` raw mark.
  - Enter `80` total marks.
- Expected:
  - Summary text shows `Estimated score: 59%`.
  - Non-digit characters are rejected or stripped.

### D6. Review layout stays compact on mobile

- Setup:
  - Open a paper review screen on a narrow mobile viewport.
- Steps:
  - Inspect the top of the review form.
- Expected:
  - `What did you score?` and `How did that paper feel?` appear inside one shared card.
  - Score inputs appear first.
  - Confidence emoji row appears below inside the same card.
  - The reminder banner, if shown, sits close to the header without excessive vertical whitespace.

### D7. Optional notes and optional weak-topic tags

- Steps:
  - Save once with notes and no topic tags.
  - Save once with topic tags and no notes.
  - Save once with both.
- Expected:
  - All three save paths succeed.
  - Tagging is optional.
  - No tags means no topic-level confidence or `lastReviewed` updates.
  - Completed review clears the persisted timer before success is shown.
  - `Which topics need work?` starts collapsed behind the `N topics / Revisit topics` control.
  - Expanding it reveals the topic chips.
  - Selected topics are reflected in the small selected-count label.

### D7a. Notes and weak topics surface in Progress through the Notes popup

- Setup:
  - Save a paper attempt with multiline notes.
  - Save the same or another paper attempt with tagged weak topics.
- Steps:
  - Open `Progress`.
  - Switch to `Recently Reviewed`.
  - Find the relevant paper row.
  - Click the `Notes` pill.
- Expected:
  - A popup overlay opens.
  - The full saved note is shown, not a truncated inline preview.
  - Newlines in the saved note are preserved.
  - If tagged weak topics exist, a `Weak topics` section appears below the note.
  - Weak topics render as warm pale-yellow chips.
  - Closing the popup returns to the same Progress position.

### D8. Completed paper review does not restore after reload

- Setup:
  - Start and finish any full paper.
- Steps:
  - Complete the review form.
  - Wait for success UI.
  - Reload the app.
- Expected:
  - Review UI does not reappear.
  - No duplicate attempt can be created by re-submitting.
  - IndexedDB key `timer` is either removed or contains `session: null`.

## Section E. Multiple Attempts, Confidence, And Status

### E1. Multiple same-day attempts are preserved in storage

- Setup:
  - Complete the same paper twice on the same day, or seed with the IndexedDB snippet.
- Steps:
  - Inspect `app.paperAttempts` in DevTools.
- Expected:
  - Each attempt is stored as a separate `PaperAttempt`.
  - No write-side merging occurs in Zustand / persisted state.

### E2. Multiple same-day attempts collapse into one Progress row

- Setup:
  - Same as `E1`.
- Steps:
  - Reload the app after seeding.
  - Open `Progress`.
  - Switch to `Recently Reviewed`.
- Expected:
  - Only one row appears for that paper on that day.
  - Secondary text shows `N attempts today` or equivalent day label.

### E3. Latest attempt drives grouped paper row state

- Setup:
  - Seed two same-day attempts with different confidence and marks.
- Steps:
  - Reload the app after seeding.
  - Open `Progress`.
  - Inspect the grouped paper row.
- Expected:
  - Confidence reflects the latest attempt of the day.
  - Action reflects the latest attempt of the day.
  - `Last: XX%` reflects the latest attempt if it has marks.
  - Grouped notes use the most recent attempt in that day-group that actually has a note.
  - Grouped weak-topic chips use the union of tagged topics across that same day-group.

### E4. Paper confidence remains the primary subjective signal

- Steps:
  - Log a high mark with low confidence.
  - Log a low mark with high confidence.
- Expected:
  - Confidence column reflects the selected confidence, not an inferred confidence from marks.
  - Marks remain supporting evidence, not the primary displayed confidence signal.

### E5. Paper action logic stays simple

- Expected paper actions:
  - `Sit another paper`
  - `On track`
  - `Keep sharp`
- Expected:
  - No fake “Review mistakes” workflow is implied.
  - Status copy should not read like duplicate confidence text.

## Section F0. Persistence And Recovery Edge Cases

### F0.1. Orphaned paper timer is hidden and durably cleared

- Setup:
  - Seed a paper timer in IndexedDB with `targetId` pointing to a real paper, for example `geo-p1`.
  - Remove that paper from `app.papers`.
- Steps:
  - Reload the app.
  - Confirm normal app load.
  - Inspect IndexedDB key `timer`.
- Expected:
  - No session overlay appears.
  - No fallback session for another paper in the same offering appears.
  - IndexedDB `timer` is cleared:
    - either key removed
    - or `{ session: null, settings }`

### F0.2. Orphaned paper timer stays cleared on a second cold reload

- Setup:
  - Continue from `F0.1`.
- Steps:
  - Reload the app again without restoring the missing paper.
  - Inspect IndexedDB `timer` again.
- Expected:
  - App still loads normally.
  - No session overlay appears.
  - `timer` remains cleared and does not repopulate.

### F0.3. Orphaned topic timer is hidden and durably cleared

- Setup:
  - Seed a topic timer in IndexedDB with `targetId` pointing to a real topic, for example `cs-001`.
  - Remove that topic from `app.topics` or break its parent chain.
- Steps:
  - Reload the app.
  - Inspect IndexedDB key `timer`.
- Expected:
  - No topic session overlay appears.
  - App loads normally.
  - IndexedDB `timer` is cleared:
    - either key removed
    - or `{ session: null, settings }`

### F0.4. Restored unfinished review still behaves differently from completed review

- Setup:
  - Finish a full paper and stop on the review screen without submitting.
- Steps:
  - Reload once.
- Expected:
  - Review screen is restored.
  - Reminder banner explains that the unfinished paper review was restored.
- Then:
  - Complete the review.
  - Reload again.
- Expected:
  - Review screen does not return.
  - IndexedDB `timer` is cleared:
    - either key removed
    - or `{ session: null, settings }`

## Section F. Progress Page Cards, Velocity, And Breakdown Grid

### F1. `Total Studied` includes topic sessions and full papers

- Setup:
  - Log topic sessions and full-paper attempts in the selected subjects.
- Expected:
  - `Total Studied` sums both types of activity.
  - Display stays compact:
    - under 1 hour: `33m`
    - whole hours: `3h`
    - mixed totals: `3h 20m`

### F2. `Papers Attempted` counts saved full-paper attempts

- Setup:
  - Save multiple full-paper attempts.
- Expected:
  - Card count equals total saved `PaperAttempt` entries in the selected subjects.
  - Repeated attempts of the same paper still count as additional attempts.
  - Accent helper text shows `+N this week` when applicable.

### F3. Last Session card for topic session

- Setup:
  - Complete a topic session last.
- Expected:
  - The card shows the topic score / confidence outcome in the current design.
  - Footer subject/topic label is bold and readable.
  - If the session was today, the card also shows cumulative study time for today.

### F4. Last Session card for full paper session

- Setup:
  - Complete a paper attempt last.
- Expected:
  - Subject and paper label is clear.
  - Paper score / confidence appears in the current card design without noisy duplication.
  - If the attempt was today, the card also shows cumulative study time for today.

### F5. Study velocity includes paper duration

- Setup:
  - Log only paper attempts on a day.
- Steps:
  - Reload the app after seeding.
  - Open `Progress`.
  - Inspect `Study Velocity`.
- Expected:
  - The day bar increases based on paper duration.
  - Paper-only study days are not omitted from the graph.

### F6. Daily streak increments on paper-only days

- Setup:
  - Log a paper attempt on a fresh day without topic sessions.
- Steps:
  - Reload the app after seeding.
  - Open `Progress`.
- Expected:
  - `Daily Streak` counts the day as studied.

### F7. `Priority Now` excludes full papers

- Setup:
  - Have recent paper attempts and outstanding topic work.
- Steps:
  - Open `Progress`.
  - View `Priority Now`.
- Expected:
  - Full-paper rows do not appear there.
  - `Priority Now` remains topic-focused.

### F8. `Recently Reviewed` includes topics and grouped full papers

- Setup:
  - Have both topic sessions and paper attempts.
- Steps:
  - Reload the app after seeding.
  - Open `Progress`.
  - Switch to `Recently Reviewed`.
- Expected:
  - Mixed topic and full-paper rows are visible.
  - Rows are sorted descending by real recency timestamp, not by rough date text only.

### F9. Confidence column for paper rows

- Expected:
  - Confidence emoji reflects the paper attempt confidence.
  - Marks are secondary.
  - Topic-style copy should not mislead users into thinking paper confidence is system-derived.

### F10. Topic Mastery / mixed breakdown visual scan

- Expected:
  - Paper rows remain visually legible in the same grid as topics.
  - Attempt count helper text appears when grouped.
  - `Keep sharp` and other paper status chips include explanation text where applicable.
  - `Notes` appears as a separate clickable pill under the action pill, not beside it.
  - If no note exists, no `Notes` pill is shown.

### F11. Notes popup behavior in mixed breakdown rows

- Setup:
  - Have one topic row with a saved note.
  - Have one paper row with a saved note.
- Steps:
  - Open `Progress`.
  - Switch to `Recently Reviewed`.
  - Open each `Notes` pill.
- Expected:
  - Topic rows open a popup showing the full note.
  - Paper rows open the same popup pattern.
  - Popup title uses `Subject · Topic/Paper`.
  - Popup has a close icon.
  - Topic popup does not show weak topics.
  - Paper popup shows weak topics only when tagged topics exist.

## Section G. Topic Side Effects From Paper Review

### G1. No tags means no topic mutation

- Setup:
  - Log a paper attempt without tagging topics.
- Steps:
  - Inspect affected topics in IndexedDB before and after.
- Expected:
  - Topic `confidence` does not change.
  - Topic `lastReviewed` does not change.

### G2. Tagged weak topics update minimally

- Setup:
  - Log a paper attempt and tag one or more topics.
- Expected:
  - Tagged topic confidence decreases by `1`.
  - Confidence floors at `1`.
  - `lastReviewed` becomes today.
  - `performanceScore` does not change.

### G3. Tags must belong to the selected paper

- Setup:
  - Force an invalid tag into a paper attempt through DevTools if needed.
- Expected:
  - Store validation should reject or ignore topics not belonging to the chosen paper.

## Section H. Edge Cases Worth Manually Forcing

### H1. Multi-paper subject where earliest paper is already past

- Use the IndexedDB paper-date snippet.
- Expected:
  - Subtitle still shows all papers.
  - The user can still choose any remaining future paper in the chooser.

### H2. All papers in the past

- Force all papers for an offering to past dates.
- Expected:
  - Subject card should not crash.
  - Any displayed CTA must remain logically safe.
  - If the product still shows paper actions, flag this as a UX debt item for review.

### H3. Missing marks

- Save paper attempts with confidence only.
- Expected:
  - Progress still shows the attempt.
  - Time and attempt totals include it.
  - Score-average surfaces do not break.

### H4. Very large number of attempts on the same day

- Seed `5+` attempts for one paper on one day.
- Expected:
  - Progress still shows one grouped row.
  - Secondary helper text scales correctly.
  - UI does not wrap awkwardly or overflow.

### H5. Reload during active paper timer

- Start a paper.
- Reload the browser.
- Expected:
  - Timer recovers correctly.
  - Recovered paper/offering/subject mapping is still valid.

### H6. Recovered timer with deleted paper

- Start a paper.
- Manually remove that paper from IndexedDB.
- Reload.
- Expected:
  - App discards the orphaned timer safely.
  - No crash loop.
  - No timer overlay appears.
  - IndexedDB `timer` is cleared:
    - either key removed
    - or `{ session: null, settings }`

## Section I. Manual Pixel / Layout Checks

- Subject-card metadata line:
  - spacing between paper segments feels deliberate
  - separators do not feel cramped
  - long multi-paper lines should still wrap cleanly
- Multi-paper chooser:
  - selected state is visible at a glance
  - no pill should look accidentally disabled when not selected
- Disabled CTAs:
  - look intentionally disabled, not broken
- Paper pre-start screen:
  - retains the existing button hierarchy and session-preference styling
- Progress:
  - grouped paper rows do not visually overpower topic rows
  - helper text remains readable but secondary
  - `Notes` pill sits below the action pill and reads as clickable
  - weak-topic chips in the popup match the pale amber treatment of the `Next exam in x days` pill

## Section J. Automation / Regression Coverage Already Added

- Today:
  - create suggested plan
  - back from calendar-opened subject picker
  - generic multi-paper subject-card paper launch auto-selects the nearest upcoming paper
  - explicit calendar paper launch stays scoped
  - multi-paper subject card shows all paper countdowns
  - mobile Today keeps legend and long subject names readable
- Timer:
  - orphaned paper timer recovery clears persisted timer state
  - orphaned topic timer recovery clears persisted timer state
- Progress:
  - total studied card
  - papers attempted card
  - grouped same-day paper attempts
  - paper rows excluded from `Priority Now`
  - paper rows included in `Recently Reviewed`
  - last-session card updates for full papers
  - notes pill popup opens and closes for topic and paper rows
  - paper-note popup shows tagged weak-topic chips

## Section K. Deferred / Out Of Scope

### K1. Split button on subject card

- Not implemented in the current build.
- Intentionally replaced by the safer pre-start paper chooser for multi-paper subjects.

### K2. If split button is ever revived later, add these scenarios before shipping

- Main segment starts nearest upcoming paper.
- Chevron opens full paper list.
- Clicking chevron does not expand topics.
- Clicking outside closes menu.
- Keyboard `Tab`, `Enter`, `Space`, and `Escape` all work correctly.
- Mobile tap targets remain large enough.
- Main segment and menu segment never disagree about which paper is “default”.

## Sign-Off Criteria

- No paper launch path crashes.
- Single-paper launch flow is unchanged.
- Generic multi-paper subject-card launch preselects the nearest upcoming paper.
- Explicit paper launch paths remain explicit and fast.
- Progress groups same-day repeated paper attempts correctly.
- Paper attempts affect velocity and streak.
- No topic mutation happens without explicit topic tags.
- No orphaned timer recovery crash occurs.
- Manual scan on desktop and mobile shows no obvious layout regressions.
