# Progress Scenario: At-Risk Dashboard

Purpose: seed weak topics, stale reviews, low session scores, and friction notes so the Progress page shows stress, weak spots, and strong next-focus guidance.

Expected UI:
- Hero visible
- KPI row visible
- Momentum chart visible
- Weak topics visible in expanded subject rows
- Confidence legend visible in Focus next sections
- Likely `Needs attention` or `At risk soon` chips
- Strong next-focus guidance

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
  const topicIds = topicIdsForOfferings(state, selectedOfferingIds, 15)

  state.onboarded = true
  state.selectedOfferingIds = selectedOfferingIds
  state.userState = { energyLevel: 2, stress: 4 }

  state.topics = state.topics.map((t) => {
    if (!selectedOfferingIds.includes(t.offeringId)) return t
    const idx = topicIds.indexOf(t.id)
    if (idx === -1) return t

    if (idx < 5) return { ...t, confidence: 1, performanceScore: 0.35, lastReviewed: dayIso(12) }
    if (idx < 10) return { ...t, confidence: 2, performanceScore: 0.48, lastReviewed: dayIso(18) }
    return { ...t, confidence: 3, performanceScore: 0.55, lastReviewed: null }
  })

  state.sessions = [
    { id: 's1', topicId: topicIds[0], date: dayIso(0), score: 0.42, durationSeconds: 900, timestamp: Date.now() - 1000 },
    { id: 's2', topicId: topicIds[1], date: dayIso(1), score: 0.38, durationSeconds: 1200, timestamp: Date.now() - 86400000 },
    { id: 's3', topicId: topicIds[2], date: dayIso(3), score: 0.46, durationSeconds: 900, timestamp: Date.now() - 3 * 86400000 },
    { id: 's4', topicId: topicIds[3], date: dayIso(5), score: 0.41, durationSeconds: 600, timestamp: Date.now() - 5 * 86400000 },
    { id: 's5', topicId: topicIds[0], date: dayIso(8), score: 0.58, durationSeconds: 1200, timestamp: Date.now() - 8 * 86400000 },
    { id: 's6', topicId: topicIds[1], date: dayIso(10), score: 0.55, durationSeconds: 900, timestamp: Date.now() - 10 * 86400000 },
  ]

  state.notes = [
    { id: 'n1', topicId: topicIds[0], date: dayIso(0), text: 'Still mixing up methods under time pressure.' },
    { id: 'n2', topicId: topicIds[1], date: dayIso(1), text: 'Need to relearn the steps from scratch.' },
    { id: 'n3', topicId: topicIds[2], date: dayIso(3), text: 'Confidence is low even after review.' },
    { id: 'n4', topicId: topicIds[3], date: dayIso(5), text: 'Made the same error twice.' },
  ]

  await writeAppState(state)
  location.reload()
}
```

How to use:
1. Open the app in the browser.
2. Open DevTools Console.
3. Paste the entire block above.
4. Run it and wait for the page to reload.
