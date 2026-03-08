# Past Paper Filtering Test

## Goal
Verify that topics from a paper whose exam date is already in the past are excluded from planning, while future-paper topics from the same offering remain eligible.

This also verifies that crunch mode is determined by the nearest valid future paper, not by past papers.

## What this test checks

- past-paper topics disappear from the suggested plan
- future-paper topics remain eligible
- crunch mode still activates if another future paper is within 21 days

## Prerequisites

- Have the `__planner` helper available in DevTools
- Be on a working app state after onboarding
- Restore the previous scenario first if needed

## Step 0: Restore previous scenario state if needed

```js
await __planner.restore();
__planner.clearBackup();
location.reload();
```

If reload clears the helper, re-run the helper snippet from `cooldown_test_steps.md`.

## Step 1: Apply the past-paper setup

Run this in DevTools:

```js
await __planner.update((state) => {
  state.onboarded = true;
  state.selectedOfferingIds = ['cs-aqa'];
  state.dailyPlan = [];
  state.planDay = '';

  const p = (id) => state.papers.find((x) => x.id === id);
  const t = (id) => state.topics.find((x) => x.id === id);

  // Paper 1 is in the past
  p('cs-p1').examDate = __planner.iso(__planner.daysAgo(1));

  // Paper 2 is still in the future and inside crunch window
  p('cs-p2').examDate = __planner.iso(__planner.daysAgo(-14));

  // Paper 2 topics remain eligible
  Object.assign(t('cs-009'), { lastReviewed: null, performanceScore: 0.5, confidence: 3 });
  Object.assign(t('cs-010'), { lastReviewed: __planner.iso(__planner.daysAgo(12)), performanceScore: 0.4, confidence: 2 });
  Object.assign(t('cs-011'), { lastReviewed: null, performanceScore: 0.5, confidence: 3 });
  Object.assign(t('cs-012'), { lastReviewed: __planner.iso(__planner.daysAgo(10)), performanceScore: 0.45, confidence: 2 });
  Object.assign(t('cs-013'), { lastReviewed: null, performanceScore: 0.5, confidence: 3 });
  Object.assign(t('cs-014'), { lastReviewed: __planner.iso(__planner.daysAgo(11)), performanceScore: 0.38, confidence: 2 });

  // Paper 1 topics should disappear regardless
  Object.assign(t('cs-001'), { lastReviewed: null, performanceScore: 0.2, confidence: 2 });
  Object.assign(t('cs-002'), { lastReviewed: null, performanceScore: 0.2, confidence: 2 });
  Object.assign(t('cs-003'), { lastReviewed: null, performanceScore: 0.2, confidence: 2 });
});
location.reload();
```

## Step 2: Generate the plan

After reload:
1. go to `Today`
2. click `Create suggested plan`
3. record the topics shown

## Observed result

The suggested plan showed only `cs-p2` topics:
- `Data representation`
- `Ethical impacts`
- `Networks`
- `SQL`

It did **not** show `cs-p1` topics such as:
- `Sorting and searching algorithms`
- `Pseudo-code`
- `Flowcharts`

## UI result

- `Crunch mode` chip appeared
- crunch banner appeared

This is correct because:
- `cs-p1` is in the past and is ignored
- `cs-p2` is still 14 days away, which is inside the 21-day crunch window
- crunch mode is therefore driven by the nearest valid future paper

## Pass / Fail

### Pass
- no past-paper topics appear
- only future-paper topics appear
- crunch mode is based on the remaining future paper

### Fail
- any `cs-p1` topic appears in the suggested plan
- crunch is triggered only because of the past paper rather than the valid future paper

## Verdict
This test passed.

It proves:
- past-paper topics are excluded correctly
- the nearest future paper still drives urgency and crunch mode
- planner output reflects only valid remaining papers

## Restore original state

```js
await __planner.restore();
__planner.clearBackup();
location.reload();
```
