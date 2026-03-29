# Progress Screen Scenario Pack

Manual review scenarios for the upcoming Progress screen refactor.

Use this file as the single source of truth for:
- what data to paste into IndexedDB
- what numbers the UI should show
- what those numbers mean
- which rows and drilldowns should appear

## Source Of Truth

For manual testing, use the **actual current engine behavior** as the calculation source:
- [`/Users/jimmy/code/exam-scheduler/src/lib/engine.ts`](/Users/jimmy/code/exam-scheduler/src/lib/engine.ts)
- [`/Users/jimmy/code/exam-scheduler/src/components/Progress.tsx`](/Users/jimmy/code/exam-scheduler/src/components/Progress.tsx)

Important:
- [`/Users/jimmy/code/exam-scheduler/docs/scoring_and_formula_explanation.md`](/Users/jimmy/code/exam-scheduler/docs/scoring_and_formula_explanation.md) is slightly stale on `recencyFactor`.
- The **current engine** uses stepped values:
  - reviewed today: `0.5`
  - 1-3 days: `0.7`
  - 4-6 days: `0.85`
  - 7-13 days: `1.0`
  - 14-20 days: `1.15`
  - 21+ days or never reviewed: `1.4`

## IndexedDB Target

Progress data lives in:
- DB: `gcse-scheduler`
- store: `state`
- key: `app`

The value under `app` is the persisted Zustand app state.

## Manual Review Workflow

1. Clear site storage and reload once so the app reseeds from fresh bundled data.
2. Open DevTools Console on the running app.
3. Paste one scenario snippet from this file.
4. Reload the page.
5. Review the Progress screen against the expected values below.

This assumes a fresh base state. If you have already been editing IndexedDB by hand, clear storage first.

## Metric Definitions

These are the proposed display metrics for the refactor.

### Mastery %

Show:
- `Mastery 78%`

Meaning:
- not an exam mark
- reflects current security of the topic or subject
- based on recent performance and confidence

Formula:

```text
weakness = 0.7 * (1 - performanceScore) + 0.3 * (1 - confidence / 5)
mastery = 100 * (1 - weakness)
```

Subject mastery:

```text
subjectMastery = average(topicMastery across the subject)
```

### Coverage %

Show:
- `Coverage 64%`

Meaning:
- how much of the subject has actually been reviewed

Formula:

```text
coverage = 100 * reviewedTopics / totalTopics
```

### Study Velocity

Show:
- `+25% vs last week`

Meaning:
- change in recent study volume, not a quality score

Formula:

```text
velocity = ((this7Days - previous7Days) / previous7Days) * 100
```

Use:
- total `durationSeconds` when durations exist
- otherwise fallback to session count

### Exam Readiness %

Show:
- `Exam Readiness 72%`

Meaning:
- not a predicted grade
- indicates how prepared the subject looks right now
- combines:
  - mastery
  - freshness of revision
  - coverage

Do **not** bake exam timing directly into the number. Timing should be shown separately as context like:
- `Paper 1 in 27 days`

Why:
- students read `%` as marks very easily
- timing is better presented as context and used in `Priority Now`, not hidden inside the percentage

#### Freshness Mapping

Map current engine `recencyFactor` to a display-friendly freshness score:

| Recency Factor | Meaning | Freshness |
|---|---|---:|
| `0.5` | reviewed today | `1.00` |
| `0.7` | 1-3 days ago | `0.80` |
| `0.85` | 4-6 days ago | `0.65` |
| `1.0` | 7-13 days ago | `0.50` |
| `1.15` | 14-20 days ago | `0.30` |
| `1.4` | 21+ days or null | `0.00` |

#### Readiness Formula

```text
readiness = 100 * (
  0.55 * masteryRatio +
  0.25 * freshnessRatio +
  0.20 * coverageRatio
)
```

Where:
- `masteryRatio` is `mastery / 100`
- `freshnessRatio` is the average mapped freshness across the subject
- `coverageRatio` is `coverage / 100`

## Filter Definitions

### Recently Reviewed

History lens.

Sort/filter topics by:
1. latest `lastReviewed` descending
2. latest session date descending
3. topic name ascending as tie-break

### Priority Now

Recommendation lens.

Sort/filter topics using the current engine priority logic:
- weakness
- recency
- exam urgency

This should align with current topic scoring behavior from [`/Users/jimmy/code/exam-scheduler/src/lib/engine.ts`](/Users/jimmy/code/exam-scheduler/src/lib/engine.ts).

## Shared DevTools Helper

Paste this once into DevTools before using the scenario snippets:

```js
async function loadAppState() {
  return await new Promise((resolve, reject) => {
    const req = indexedDB.open('gcse-scheduler', 2)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('state', 'readonly')
      const getReq = tx.objectStore('state').get('app')
      getReq.onsuccess = () => {
        db.close()
        resolve(structuredClone(getReq.result))
      }
      getReq.onerror = () => reject(getReq.error)
    }
    req.onerror = () => reject(req.error)
  })
}

async function saveAppState(next) {
  await new Promise((resolve, reject) => {
    const req = indexedDB.open('gcse-scheduler', 2)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('state', 'readwrite')
      tx.objectStore('state').put(next, 'app')
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => { db.close(); reject(tx.error) }
    }
    req.onerror = () => reject(req.error)
  })
}

function patchTopic(state, topicId, fields) {
  const topic = state.topics.find(t => t.id === topicId)
  if (!topic) throw new Error(`Missing topic: ${topicId}`)
  Object.assign(topic, fields)
}

function patchOfferingTopics(state, offeringId, fields) {
  state.topics
    .filter(t => t.offeringId === offeringId)
    .forEach(t => Object.assign(t, fields))
}

function resetAnalyticsState(state) {
  state.sessions = []
  state.notes = []
  state.dailyPlan = []
  state.planDay = '2026-04-15'
  state.userState = { energyLevel: 3, stress: 2 }
}
```

---

## Scenario 1: `biology_focus_strong`

Purpose:
- validate a strong single-subject view
- validate exact metric math
- validate a clean subject-card drilldown target

Selected offerings:
- `bio-aqa`

### Scenario Snippet

```js
const state = await loadAppState()
resetAnalyticsState(state)
state.selectedOfferingIds = ['bio-aqa']

patchOfferingTopics(state, 'bio-aqa', {
  confidence: 4,
  performanceScore: 0.75,
  lastReviewed: '2026-04-12',
})

patchTopic(state, 'bio-003', {
  confidence: 4,
  performanceScore: 0.85,
  lastReviewed: '2026-04-15',
})

patchTopic(state, 'bio-006', {
  confidence: 4,
  performanceScore: 0.85,
  lastReviewed: '2026-04-15',
})

patchTopic(state, 'bio-010', {
  confidence: 3,
  performanceScore: 0.60,
  lastReviewed: '2026-04-05',
})

state.sessions = [
  { id: 'bio-a1', topicId: 'bio-003', date: '2026-04-09', score: 0.72, durationSeconds: 1500, timestamp: new Date('2026-04-09T12:00:00').getTime() },
  { id: 'bio-a2', topicId: 'bio-001', date: '2026-04-10', score: 0.74, durationSeconds: 1500, timestamp: new Date('2026-04-10T12:00:00').getTime() },
  { id: 'bio-a3', topicId: 'bio-006', date: '2026-04-12', score: 0.78, durationSeconds: 1800, timestamp: new Date('2026-04-12T12:00:00').getTime() },
  { id: 'bio-a4', topicId: 'bio-003', date: '2026-04-14', score: 0.84, durationSeconds: 1800, timestamp: new Date('2026-04-14T12:00:00').getTime() },
  { id: 'bio-a5', topicId: 'bio-006', date: '2026-04-15', score: 0.86, durationSeconds: 2400, timestamp: new Date('2026-04-15T12:00:00').getTime() },
  { id: 'bio-b1', topicId: 'bio-002', date: '2026-04-03', score: 0.70, durationSeconds: 1800, timestamp: new Date('2026-04-03T12:00:00').getTime() },
  { id: 'bio-b2', topicId: 'bio-004', date: '2026-04-05', score: 0.68, durationSeconds: 1800, timestamp: new Date('2026-04-05T12:00:00').getTime() },
  { id: 'bio-b3', topicId: 'bio-005', date: '2026-04-07', score: 0.71, durationSeconds: 1800, timestamp: new Date('2026-04-07T12:00:00').getTime() },
]

await saveAppState(state)
```

### Expected Calculations

Biology has 10 topics.

Baseline for 7 topics:

```text
perf = 0.75
conf = 4
weakness = 0.7*(1-0.75) + 0.3*(1-0.8) = 0.175 + 0.06 = 0.235
mastery = 1 - 0.235 = 0.765 = 76.5%
freshness = 0.80  (last reviewed 2026-04-12)
```

Two strong topics (`bio-003`, `bio-006`):

```text
perf = 0.85
conf = 4
weakness = 0.7*(0.15) + 0.3*(0.2) = 0.105 + 0.06 = 0.165
mastery = 83.5%
freshness = 1.00  (reviewed today)
```

One weaker topic (`bio-010`):

```text
perf = 0.60
conf = 3
weakness = 0.7*(0.4) + 0.3*(0.4) = 0.28 + 0.12 = 0.40
mastery = 60.0%
freshness = 0.50  (10 days ago)
```

Subject mastery:

```text
(7*76.5 + 2*83.5 + 1*60.0) / 10
= (535.5 + 167 + 60) / 10
= 76.25%
```

Coverage:

```text
10 / 10 = 100%
```

Average freshness:

```text
(7*0.80 + 2*1.00 + 1*0.50) / 10
= 0.81
```

Exam Readiness:

```text
100 * (0.55*0.7625 + 0.25*0.81 + 0.20*1.0)
= 100 * (0.419375 + 0.2025 + 0.20)
= 82.19%
```

Study Velocity:

```text
this7Days = 1500 + 1500 + 1800 + 1800 + 2400 = 9000 sec = 150 min
prev7Days = 1800 + 1800 + 1800 = 5400 sec = 90 min
velocity = (150 - 90) / 90 = +66.7%
```

### Expected UI

Top row:
- `Mastery`: `76%`
- `Exam Readiness`: `82%`
- `Coverage`: `100%`
- `Study Velocity`: `+67% vs last week`

Context:
- nearest Biology exam: `27 days`

`Recently Reviewed` top order should start with:
1. `Cell division`
2. `Plants and bioenergetics`
3. the remaining `2026-04-12` Biology topics

`Priority Now` top item should be:
1. `Evolution and genetics` (`bio-010`)

Subject drilldown expectations:
- strongest topic: `Cell division`
- weakest topic: `Evolution and genetics`
- next best move: `Evolution and genetics`

---

## Scenario 2: `cs_low_coverage_urgent`

Purpose:
- validate low coverage
- validate readiness collapse
- validate `Priority Now`

Selected offerings:
- `cs-aqa`

### Scenario Snippet

```js
const state = await loadAppState()
resetAnalyticsState(state)
state.selectedOfferingIds = ['cs-aqa']

patchOfferingTopics(state, 'cs-aqa', {
  confidence: 3,
  performanceScore: 0.5,
  lastReviewed: null,
})

patchTopic(state, 'cs-001', {
  confidence: 3,
  performanceScore: 0.55,
  lastReviewed: '2026-04-14',
})
patchTopic(state, 'cs-002', {
  confidence: 3,
  performanceScore: 0.55,
  lastReviewed: '2026-04-14',
})
patchTopic(state, 'cs-003', {
  confidence: 2,
  performanceScore: 0.40,
  lastReviewed: '2026-04-01',
})
patchTopic(state, 'cs-004', {
  confidence: 2,
  performanceScore: 0.40,
  lastReviewed: '2026-04-01',
})

state.sessions = [
  { id: 'cs-a1', topicId: 'cs-001', date: '2026-04-14', score: 0.55, durationSeconds: 1800, timestamp: new Date('2026-04-14T12:00:00').getTime() },
  { id: 'cs-a2', topicId: 'cs-002', date: '2026-04-15', score: 0.58, durationSeconds: 1800, timestamp: new Date('2026-04-15T12:00:00').getTime() },
  { id: 'cs-b1', topicId: 'cs-003', date: '2026-04-05', score: 0.63, durationSeconds: 2400, timestamp: new Date('2026-04-05T12:00:00').getTime() },
  { id: 'cs-b2', topicId: 'cs-004', date: '2026-04-06', score: 0.62, durationSeconds: 2400, timestamp: new Date('2026-04-06T12:00:00').getTime() },
  { id: 'cs-b3', topicId: 'cs-005', date: '2026-04-07', score: 0.61, durationSeconds: 2400, timestamp: new Date('2026-04-07T12:00:00').getTime() },
]

await saveAppState(state)
```

### Expected Calculations

Computer Science has 14 topics.

Ten untouched topics remain at seed defaults:

```text
perf = 0.5
conf = 3
mastery = 53.0%
freshness = 0.00  (never reviewed)
```

Two lightly reviewed topics (`cs-001`, `cs-002`):

```text
perf = 0.55
conf = 3
weakness = 0.7*(0.45) + 0.3*(0.4) = 0.315 + 0.12 = 0.435
mastery = 56.5%
freshness = 0.80  (1 day ago)
```

Two stale weaker topics (`cs-003`, `cs-004`):

```text
perf = 0.40
conf = 2
weakness = 0.7*(0.60) + 0.3*(0.60) = 0.42 + 0.18 = 0.60
mastery = 40.0%
freshness = 0.30  (14 days ago)
```

Subject mastery:

```text
(10*53.0 + 2*56.5 + 2*40.0) / 14
= (530 + 113 + 80) / 14
= 51.64%
```

Coverage:

```text
4 / 14 = 28.57%
```

Average freshness:

```text
(10*0.00 + 2*0.80 + 2*0.30) / 14
= 2.2 / 14
= 0.157
```

Exam Readiness:

```text
100 * (0.55*0.5164 + 0.25*0.157 + 0.20*0.2857)
= 100 * (0.284 + 0.039 + 0.057)
= 38.0%
```

Study Velocity:

```text
this7Days = 1800 + 1800 = 3600 sec = 60 min
prev7Days = 2400 + 2400 + 2400 = 7200 sec = 120 min
velocity = (60 - 120) / 120 = -50%
```

### Expected UI

Top row:
- `Mastery`: `52%`
- `Exam Readiness`: `38%`
- `Coverage`: `29%`
- `Study Velocity`: `-50% vs last week`

Context:
- nearest CS exam: `28 days`

`Priority Now` top order should start with:
1. `Programming fundamentals`
2. `Data representation`
3. untouched but urgent topics after those

Status expectations:
- top subject status should read like `Needs Focus` or `At risk soon`
- `Recently Reviewed` should start with `cs-001`, `cs-002`

---

## Scenario 3: `mixed_overview_with_biology_drilldown`

Purpose:
- validate the default all-subject dashboard
- validate cross-subject comparison
- validate clicking Biology and seeing a stable drilldown

Selected offerings:
- `bio-aqa`
- `eng-lit-aqa`
- `cs-aqa`

### Scenario Snippet

```js
const state = await loadAppState()
resetAnalyticsState(state)
state.selectedOfferingIds = ['bio-aqa', 'eng-lit-aqa', 'cs-aqa']

// Biology = strong
patchOfferingTopics(state, 'bio-aqa', {
  confidence: 4,
  performanceScore: 0.75,
  lastReviewed: '2026-04-12',
})
patchTopic(state, 'bio-003', { confidence: 4, performanceScore: 0.85, lastReviewed: '2026-04-15' })
patchTopic(state, 'bio-006', { confidence: 4, performanceScore: 0.85, lastReviewed: '2026-04-15' })
patchTopic(state, 'bio-010', { confidence: 3, performanceScore: 0.60, lastReviewed: '2026-04-05' })

// English Lit = steady middle
patchOfferingTopics(state, 'eng-lit-aqa', {
  confidence: 3,
  performanceScore: 0.65,
  lastReviewed: '2026-04-13',
})

// Computer Science = weak / low coverage
patchOfferingTopics(state, 'cs-aqa', {
  confidence: 3,
  performanceScore: 0.5,
  lastReviewed: null,
})
patchTopic(state, 'cs-001', { confidence: 3, performanceScore: 0.55, lastReviewed: '2026-04-14' })
patchTopic(state, 'cs-002', { confidence: 3, performanceScore: 0.55, lastReviewed: '2026-04-14' })
patchTopic(state, 'cs-003', { confidence: 2, performanceScore: 0.40, lastReviewed: '2026-04-01' })
patchTopic(state, 'cs-004', { confidence: 2, performanceScore: 0.40, lastReviewed: '2026-04-01' })

state.sessions = [
  { id: 'bio-1', topicId: 'bio-003', date: '2026-04-12', score: 0.78, durationSeconds: 1800, timestamp: new Date('2026-04-12T12:00:00').getTime() },
  { id: 'bio-2', topicId: 'bio-006', date: '2026-04-14', score: 0.84, durationSeconds: 1800, timestamp: new Date('2026-04-14T12:00:00').getTime() },
  { id: 'bio-3', topicId: 'bio-006', date: '2026-04-15', score: 0.86, durationSeconds: 2400, timestamp: new Date('2026-04-15T12:00:00').getTime() },
  { id: 'eng-1', topicId: 'eng-lit-001', date: '2026-04-13', score: 0.66, durationSeconds: 1800, timestamp: new Date('2026-04-13T12:00:00').getTime() },
  { id: 'eng-2', topicId: 'eng-lit-002', date: '2026-04-10', score: 0.64, durationSeconds: 1800, timestamp: new Date('2026-04-10T12:00:00').getTime() },
  { id: 'cs-1', topicId: 'cs-001', date: '2026-04-14', score: 0.55, durationSeconds: 1800, timestamp: new Date('2026-04-14T12:00:00').getTime() },
  { id: 'cs-2', topicId: 'cs-002', date: '2026-04-15', score: 0.58, durationSeconds: 1800, timestamp: new Date('2026-04-15T12:00:00').getTime() },
  { id: 'prev-1', topicId: 'bio-001', date: '2026-04-05', score: 0.70, durationSeconds: 1800, timestamp: new Date('2026-04-05T12:00:00').getTime() },
  { id: 'prev-2', topicId: 'eng-lit-003', date: '2026-04-06', score: 0.63, durationSeconds: 1800, timestamp: new Date('2026-04-06T12:00:00').getTime() },
  { id: 'prev-3', topicId: 'cs-003', date: '2026-04-07', score: 0.61, durationSeconds: 2400, timestamp: new Date('2026-04-07T12:00:00').getTime() },
]

await saveAppState(state)
```

### Expected Calculations

Topic counts:
- Biology: `10`
- English Lit: `5`
- CS: `14`
- total selected topics: `29`

Subject mastery inputs:
- Biology: `76.25%`
- English Lit:
  - `perf=0.65`, `conf=3`
  - mastery = `63.5%`
- CS: `51.64%`

Overall mastery:

```text
(10*76.25 + 5*63.5 + 14*51.64) / 29
= (762.5 + 317.5 + 722.96) / 29
= 62.17%
```

Freshness inputs:
- Biology avg freshness: `0.81`
- English Lit freshness: `0.80`
- CS avg freshness: `0.157`

Overall freshness:

```text
(10*0.81 + 5*0.80 + 14*0.157) / 29
= (8.1 + 4.0 + 2.198) / 29
= 0.49
```

Coverage inputs:
- Biology: `100%`
- English Lit: `100%`
- CS: `28.57%`

Overall coverage:

```text
(10 + 5 + 4) / 29 = 65.52%
```

Overall Exam Readiness:

```text
100 * (0.55*0.6217 + 0.25*0.49 + 0.20*0.6552)
= 100 * (0.342 + 0.123 + 0.131)
= 59.6%
```

Study Velocity:

```text
this7Days = 1800 + 1800 + 2400 + 1800 + 1800 + 1800 + 1800
          = 13200 sec = 220 min

prev7Days = 1800 + 1800 + 2400
          = 6000 sec = 100 min

velocity = (220 - 100) / 100 = +120%
```

### Expected UI

Overall top row:
- `Mastery`: `62%`
- `Exam Readiness`: `60%`
- `Coverage`: `66%`
- `Study Velocity`: `+120% vs last week`

All-subject expectations:
- Biology card should look strongest
- CS should surface the weakest risk state
- English Lit should sit in the middle

After clicking `Biology`:
- top row should switch to:
  - `Mastery`: `76%`
  - `Exam Readiness`: `82%`
  - `Coverage`: `100%`
  - `Study Velocity`: use Biology-only subset if the UI becomes subject-scoped
- strongest topic: `Cell division`
- weakest topic: `Evolution and genetics`
- `Priority Now` first item: `Evolution and genetics`

## What The UI Should Explain

For student-facing helper text:

### Mastery

```text
This is not an exam mark. It reflects how secure this topic or subject currently looks based on your recent performance and confidence.
```

### Exam Readiness

```text
This is not a predicted grade. It reflects recent performance, confidence, how recently you revised, and how much of the subject you have covered.
```

### Coverage

```text
This shows how much of this subject you have reviewed so far.
```

## Recommended Next Step

Once the Progress refactor starts, this file should remain the reference for:
- manual DevTools review
- Playwright fixture creation
- expected numbers in assertions
- popover/help copy for metric explanations
