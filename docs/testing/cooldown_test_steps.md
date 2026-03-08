# Cooldown Scenario Test

## Goal
Verify that a topic which is strong enough to appear in the suggested plan will drop out after being marked as studied today.

This proves the new cooldown behavior is working at the topic level.

## What this test checks

Before cooldown:
- `Sorting and searching algorithms` (`cs-001`) should appear in the suggested plan.

After cooldown:
- the same topic should drop out
- another topic may replace it, including another Computer Science topic

This is expected:
- cooldown should suppress the same topic
- it should not suppress the entire subject

## Prerequisites

- Start from a clean app state
- Complete onboarding
- Be on the `Today` page
- Do not start a study session
- Do not use the timer

This test is only for the planner output.

## Step 0: Reset local state

Run this in DevTools:

```js
(async () => {
  indexedDB.deleteDatabase('gcse-scheduler');
  localStorage.clear();
  sessionStorage.clear();
  setTimeout(() => location.reload(), 500);
})();
```

Then:
1. wait for reload
2. onboard normally
3. land on `Today`

## Step 1: Install helper

Run this once in DevTools:

```js
(async () => {
  const DB_NAME = 'gcse-scheduler';
  const STORE_NAME = 'state';
  const STATE_KEY = 'app';
  const BACKUP_KEY = '__planner_backup__';

  const openDb = () =>
    new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 2);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });

  const readState = async () => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(STATE_KEY);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  };

  const writeState = async (state) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.objectStore(STORE_NAME).put(state, STATE_KEY);
    });
  };

  const iso = (d) => d.toISOString().slice(0, 10);
  const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  };

  window.__planner = {
    iso,
    daysAgo,
    async update(mutator) {
      const state = await readState();
      if (!localStorage.getItem(BACKUP_KEY)) {
        localStorage.setItem(BACKUP_KEY, JSON.stringify(state));
      }
      mutator(state);
      await writeState(state);
    },
    async restore() {
      const raw = localStorage.getItem(BACKUP_KEY);
      if (!raw) return console.warn('No backup found');
      await writeState(JSON.parse(raw));
    },
    clearBackup() {
      localStorage.removeItem(BACKUP_KEY);
    }
  };

  console.log('planner helper ready');
})();
```

## Step 2: Set the controlled baseline

Run this:

```js
await __planner.update((state) => {
  state.onboarded = true;
  state.selectedOfferingIds = ['cs-aqa', 'bio-aqa', 'maths-edexcel', 'eng-lit-aqa'];
  state.dailyPlan = [];
  state.planDay = '';
  state.sessions = [];
  state.notes = [];

  const t = (id) => state.topics.find((x) => x.id === id);

  Object.assign(t('cs-001'), {
    lastReviewed: __planner.iso(__planner.daysAgo(18)),
    performanceScore: 0.22,
    confidence: 2,
  });

  Object.assign(t('bio-002'), {
    lastReviewed: __planner.iso(__planner.daysAgo(12)),
    performanceScore: 0.42,
    confidence: 3,
  });

  Object.assign(t('maths-004'), {
    lastReviewed: __planner.iso(__planner.daysAgo(12)),
    performanceScore: 0.44,
    confidence: 3,
  });

  Object.assign(t('eng-lit-001'), {
    lastReviewed: __planner.iso(__planner.daysAgo(12)),
    performanceScore: 0.46,
    confidence: 3,
  });

  ['cs-002', 'cs-003', 'cs-005', 'cs-014'].forEach((id) => {
    Object.assign(t(id), {
      lastReviewed: __planner.iso(__planner.daysAgo(2)),
      performanceScore: 0.7,
      confidence: 3,
    });
  });
});
location.reload();
```

## Step 3: Generate the baseline plan

After reload:
1. go to `Today`
2. click `Create suggested plan`
3. write down the 4 topics shown

### Expected baseline result
`Sorting and searching algorithms` should appear.

If it does not appear, stop and record the 4 topics shown.

## Step 4: Apply cooldown

Run this:

```js
await __planner.update((state) => {
  const t = (id) => state.topics.find((x) => x.id === id);

  Object.assign(t('cs-001'), {
    lastReviewed: __planner.iso(new Date()),
    performanceScore: 0.22,
    confidence: 2,
  });

  state.dailyPlan = [];
  state.planDay = '';
});
location.reload();
```

### Important
The last two lines are required:

```js
state.dailyPlan = [];
state.planDay = '';
```

Without them, the app may keep showing the previously generated plan instead of recomputing a new one.

## Step 5: Generate the cooldown plan

After reload:
1. go to `Today`
2. click `Create suggested plan`
3. write down the 4 topics shown

### Expected cooldown result
`Sorting and searching algorithms` should no longer appear.

A different topic may replace it, including another Computer Science topic such as:
- `File handling`
- `Arrays`

That still counts as a pass.

## Pass / Fail

### Pass
- baseline plan includes `Sorting and searching algorithms`
- cooldown plan does not include `Sorting and searching algorithms`

### Fail
- `Sorting and searching algorithms` still appears after the cooldown step

## Why this is a valid test

This test isolates one change:
- only `cs-001.lastReviewed` moves from stale to today

Everything else remains the same.

So if the topic disappears after the cooldown step, that change is coming from the recency penalty, not from unrelated planner changes.

## Restore original state

When finished, run:

```js
await __planner.restore();
__planner.clearBackup();
location.reload();
```

## Notes

- This test is for the Today planner, not Progress.
- Do not use `Start studying`.
- Do not inspect timer/session behavior.
- Ignore banner behavior for this test unless it blocks the planner.
