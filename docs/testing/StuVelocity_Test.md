# Study Velocity Test Harness

## Purpose

- Seed the Progress page with predictable `Study Velocity` patterns from the browser console.
- Verify mobile carousel behavior for:
  - `This Week` default
  - `Last Week` paging
  - swipe left/right
  - bold selected bar/date
  - `mins` vs `hrs` Y-axis label
- Catch rendering regressions for:
  - sparse weeks
  - dense busy weeks
  - paper duration contribution
  - negative vs positive velocity

## Pre-Flight

1. Run the app:

```bash
npm run dev
```

2. Open the app in Chrome.
3. Open DevTools.
4. Use the console snippets below.
5. After each seed:
   - reload once
   - open `Progress`
   - on mobile, check:
     - `This Week` is the default page
     - dots are centered and clickable
     - swipe changes page
     - selected bar/date become bold
     - selecting a bar does not lock the carousel to that week

## Console Helpers

Paste this once per DevTools session.

```js
async function withAppState(mutator) {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open('gcse-scheduler', 2)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })

  const app = await new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readonly')
    const req = tx.objectStore('state').get('app')
    req.onsuccess = () => resolve(structuredClone(req.result))
    req.onerror = () => reject(req.error)
  })

  mutator(app)

  await new Promise((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite')
    tx.objectStore('state').put(app, 'app')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  db.close()
  location.reload()
}

function dayKey(daysAgo) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

function stamp(daysAgo, hour = 18) {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  d.setDate(d.getDate() - daysAgo)
  return d.getTime()
}

function makeSession(topicId, daysAgo, minutes, score = 0.72) {
  return {
    id: `sv-${topicId}-${daysAgo}-${Math.random().toString(36).slice(2, 7)}`,
    topicId,
    date: dayKey(daysAgo),
    score,
    durationSeconds: minutes * 60,
    timestamp: stamp(daysAgo, 19),
  }
}

function makePaperAttempt(paperId, daysAgo, minutes, confidence = 4, rawMark = 52, totalMarks = 80) {
  return {
    id: `sv-paper-${paperId}-${daysAgo}-${Math.random().toString(36).slice(2, 7)}`,
    paperId,
    date: dayKey(daysAgo),
    timestamp: stamp(daysAgo, 20),
    durationSeconds: minutes * 60,
    confidence,
    rawMark,
    totalMarks,
    source: 'calendar',
  }
}

function resetStudyVelocityState(app) {
  app.selectedOfferingIds = ['cs-aqa', 'bio-aqa', 'maths-edexcel']
  app.sessions = []
  app.paperAttempts = []
}

async function seedStudyVelocity({ sessions = [], paperAttempts = [] }) {
  await withAppState((app) => {
    resetStudyVelocityState(app)
    app.sessions = sessions
    app.paperAttempts = paperAttempts
  })
}
```

## Initial set up
Use /Users/jimmy/code/exam-scheduler/docs/testing/integration-test-seed.json to set up the view and look at Study Velocity Graph on Progeess page

## Stable Seed IDs

Use these IDs in the scenarios below:

- Topics:
  - `cs-001`
  - `cs-002`
  - `cs-003`
  - `bio-001`
  - `bio-002`
  - `maths-001`
  - `maths-002`
- Papers:
  - `bio-p1`
  - `cs-p1`
  - `geo-p1`

## Global Verification Checklist

Run these checks after every scenario:

1. Open `Progress`.
2. Confirm `Study Velocity` appears.
3. Confirm desktop shows 14 bars.
4. Confirm mobile shows 7 bars and defaults to `This Week`.
5. Confirm the Y-axis label is correct:
   - `mins` for minute-scale scenarios
   - `hrs` for hour-scale scenarios
6. Click one non-zero bar:
   - bar becomes visually selected
   - date below becomes bold
   - `Reviewed on ...` filter appears
7. On mobile:
   - tap the left dot -> `Last Week`
   - swipe back -> `This Week`
8. On mobile, after selecting one non-zero bar:
   - tap the other week dot
   - confirm the carousel still changes week
   - confirm the previously selected bar is no longer visible if it belongs to the other week

## Scenario 1 — Empty 14-Day Window

### Seed

```js
await seedStudyVelocity({
  sessions: [],
  paperAttempts: [],
})
```

### Expect

- In the fully empty case, `Study Velocity` is not rendered.
- The empty Progress message should be visible instead.
- No clickable non-zero bars exist because there is no chart.

## Scenario 2 — Sparse Minutes This Week

### Seed

```js
await seedStudyVelocity({
  sessions: [
    makeSession('cs-001', 2, 3),
    makeSession('bio-001', 1, 8),
    makeSession('cs-002', 0, 12),
  ],
})
```

### Expect

- `This Week` has a few short towers.
- `Last Week` is empty.
- Y-axis label is `mins`.
- Today or yesterday bars are visibly selectable.
- After selecting a current-week bar, the `Last Week` dot should still switch the carousel.

## Scenario 3 — Dense Busy This Week In Hours

### Seed

```js
await seedStudyVelocity({
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
```

### Expect

- `This Week` is visually dense with tall towers.
- Y-axis label becomes `hrs`.
- Top tick values should be hour-like, not minute-like.

## Scenario 4 — Busy Last Week, Quiet This Week

### Seed

```js
await seedStudyVelocity({
  sessions: [
    makeSession('maths-001', 13, 80),
    makeSession('maths-002', 12, 90),
    makeSession('cs-001', 11, 70),
    makeSession('bio-001', 10, 85),
    makeSession('cs-002', 9, 95),
    makeSession('bio-002', 2, 10),
    makeSession('cs-003', 0, 6),
  ],
})
```

### Expect

- `This Week` default page looks sparse.
- `Last Week` page looks much taller/busier.
- Header delta should feel negative vs last week.

## Scenario 5 — Busy Both Weeks

### Seed

```js
await seedStudyVelocity({
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
```

### Expect

- Both week pages look full and balanced.
- Towers should look stable, not compressed or floating.
- Desktop 14-bar strip should still read clearly.

## Scenario 6 — Threshold Test: Minutes To Hours

### Seed

```js
await seedStudyVelocity({
  sessions: [
    makeSession('cs-001', 2, 59),
    makeSession('bio-001', 1, 60),
    makeSession('cs-002', 0, 61),
  ],
})
```

### Expect

- Because the max day is `60+` minutes, the Y-axis label should switch to `hrs`.
- Check that this still looks sensible and does not confuse the scale.

## Scenario 7 — Paper Duration Contributes To Bars

### Seed

```js
await seedStudyVelocity({
  sessions: [
    makeSession('cs-001', 2, 20),
    makeSession('bio-001', 0, 15),
  ],
  paperAttempts: [
    makePaperAttempt('bio-p1', 1, 90),
  ],
})
```

### Expect

- The paper-attempt day should create a visibly taller bar.
- Selecting that day should still filter Progress correctly.
- This confirms papers contribute to velocity, not just topic sessions.

## Scenario 8 — Previous Week Selection On Mobile

### Seed

```js
await seedStudyVelocity({
  sessions: [
    makeSession('cs-001', 12, 35),
    makeSession('bio-001', 11, 50),
    makeSession('maths-001', 10, 45),
  ],
})
```

### Expect

- `This Week` is the initial page even though only `Last Week` has data.
- Tap the left dot to open `Last Week`.
- Tap one non-zero bar:
  - selected bar stands out
  - day label becomes bold
  - selected date in the header becomes bold
- Tap the `This Week` dot again:
  - the carousel should switch back cleanly
  - the previous-week selected bar should not keep the carousel pinned

## Scenario 9 — Single Active Day

### Seed

```js
await seedStudyVelocity({
  sessions: [
    makeSession('cs-001', 0, 25),
  ],
})
```

### Expect

- One tower only.
- It should still feel clearly tappable.
- The selected state should be obvious, not tiny or washed out.

## Scenario 10 — Multi-Subject Same-Day Stack

### Seed

```js
await seedStudyVelocity({
  sessions: [
    makeSession('cs-001', 1, 20),
    makeSession('bio-001', 1, 25),
    makeSession('maths-001', 1, 30),
    makeSession('cs-002', 0, 35),
    makeSession('bio-002', 0, 15),
  ],
})
```

### Expect

- Bars should render as stacked subject segments.
- Tower shape should still feel clean.
- No visual collapse or stripe-like flattening.

## Regression Watchlist

Specifically look for these breakages:

- Bars look like flat chips instead of towers.
- Mobile shows more than 7 visible bars.
- `This Week` is not the default mobile page.
- Dots are not centered.
- Swipe does nothing.
- Selecting a bar traps the carousel on the same week.
- Selected bar is not visually stronger.
- Selected date below is not bold.
- Y-axis unit is missing or wrong.
- Busy weeks force awkward clipping or overflow.

## Quick Reset

To clear all custom Study Velocity seeds:

```js
await seedStudyVelocity({
  sessions: [],
  paperAttempts: [],
})
```
