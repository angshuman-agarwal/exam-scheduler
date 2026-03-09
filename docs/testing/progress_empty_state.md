# Progress Scenario: Empty State

Purpose: seed an onboarded student with selected subjects but no study history, so the Progress page shows the calm empty dashboard.

Expected UI:
- Hero visible with CTA
- Empty message card visible
- No KPI row
- No momentum chart
- No subject allocation card
- No sessions list
- No best next focus card

```js
async function readAppState() {
  return await new Promise((resolve, reject) => {
    const openReq = indexedDB.open('gcse-scheduler', 2)
    openReq.onerror = () => reject(openReq.error)
    openReq.onsuccess = () => {
      const db = openReq.result
      const tx = db.transaction('state', 'readonly')
      const store = tx.objectStore('state')
      const getReq = store.get('app')
      getReq.onerror = () => reject(getReq.error)
      getReq.onsuccess = () => resolve(getReq.result)
    }
  })
}

async function writeAppState(next) {
  return await new Promise((resolve, reject) => {
    const openReq = indexedDB.open('gcse-scheduler', 2)
    openReq.onerror = () => reject(openReq.error)
    openReq.onsuccess = () => {
      const db = openReq.result
      const tx = db.transaction('state', 'readwrite')
      const store = tx.objectStore('state')
      const putReq = store.put(next, 'app')
      putReq.onerror = () => reject(putReq.error)
      putReq.onsuccess = () => resolve()
    }
  })
}

function dayIso(daysAgo = 0) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

function pickOfferingsBySubjectNames(state, names) {
  const subjectIds = new Set(
    state.subjects.filter((s) => names.includes(s.name)).map((s) => s.id)
  )
  return state.offerings.filter((o) => subjectIds.has(o.subjectId)).map((o) => o.id)
}

function topicIdsForOfferings(state, offeringIds, limit = 20) {
  return state.topics
    .filter((t) => offeringIds.includes(t.offeringId))
    .slice(0, limit)
    .map((t) => t.id)
}

function resetDerivedState(state) {
  return {
    ...state,
    dailyPlan: [],
    planDay: dayIso(0),
    userState: { energyLevel: 3, stress: 2 },
  }
}

{
  const state = resetDerivedState(await readAppState())
  const selectedOfferingIds = pickOfferingsBySubjectNames(
    state,
    ['Maths', 'Chemistry', 'English Literature']
  ).slice(0, 3)

  state.onboarded = true
  state.selectedOfferingIds = selectedOfferingIds
  state.sessions = []
  state.notes = []

  state.topics = state.topics.map((t) =>
    selectedOfferingIds.includes(t.offeringId)
      ? { ...t, confidence: 3, performanceScore: 0.5, lastReviewed: null }
      : t
  )

  await writeAppState(state)
  location.reload()
}
```

How to use:
1. Open the app in the browser.
2. Open DevTools Console.
3. Paste the entire block above.
4. Run it and wait for the page to reload.
