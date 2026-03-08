# Urgent Boundary Test (7 Days vs 8 Days)

## Goal
Verify that the urgent boundary behaves correctly:
- at **7 days**, the urgent subject can fully dominate the suggested plan
- at **8 days**, urgency softens and other subjects can re-enter the plan

This proves the `<= 7 days` boundary is working as intended.

## What this test checks

- `7 days` is treated as fully urgent
- `8 days` is no longer treated the same way
- a competing subject can reappear once the urgent subject moves outside the exact urgent window

## Prerequisites

- Have the `__planner` helper available in DevTools
- Be on a working app state after onboarding
- If needed, restore prior test state first

## Step 0: Restore previous scenario state if needed

```js
await __planner.restore();
__planner.clearBackup();
location.reload();
```

If reload clears the helper, re-run the helper snippet from `cooldown_test_steps.md`.

## Step 1: Apply the 7-day setup

Run this in DevTools:

```js
await __planner.update((state) => {
  state.onboarded = true;
  state.selectedOfferingIds = ['cs-aqa', 'bio-aqa', 'eng-lit-aqa'];
  state.dailyPlan = [];
  state.planDay = '';

  const t = (id) => state.topics.find((x) => x.id === id);
  const p = (id) => state.papers.find((x) => x.id === id);

  p('cs-p1').examDate = __planner.iso(__planner.daysAgo(-7));
  p('cs-p2').examDate = __planner.iso(__planner.daysAgo(20));

  p('bio-p1').examDate = __planner.iso(__planner.daysAgo(-30));
  p('bio-p2').examDate = __planner.iso(__planner.daysAgo(-60));

  p('eng-lit-p1').examDate = __planner.iso(__planner.daysAgo(-28));
  p('eng-lit-p2').examDate = __planner.iso(__planner.daysAgo(-40));

  Object.assign(t('cs-001'), { lastReviewed: null, performanceScore: 0.5, confidence: 3 });
  Object.assign(t('cs-002'), { lastReviewed: null, performanceScore: 0.5, confidence: 3 });
  Object.assign(t('cs-003'), { lastReviewed: null, performanceScore: 0.5, confidence: 3 });
  Object.assign(t('cs-005'), { lastReviewed: __planner.iso(__planner.daysAgo(14)), performanceScore: 0.35, confidence: 2 });

  Object.assign(t('bio-002'), { lastReviewed: __planner.iso(__planner.daysAgo(18)), performanceScore: 0.4, confidence: 2 });
  Object.assign(t('eng-lit-001'), { lastReviewed: __planner.iso(__planner.daysAgo(18)), performanceScore: 0.42, confidence: 2 });
});
location.reload();
```

## Step 2: Generate the 7-day plan

After reload:
1. go to `Today`
2. click `Create suggested plan`
3. record the 4 topics shown

### Observed result
- `File handling`
- `Flowcharts`
- `Pseudo-code`
- `Random number generation`

All 4 were Computer Science.

### Interpretation
At exactly 7 days, the urgent subject fully dominated the suggested plan.

## Step 3: Move the same subject to 8 days

Run this in DevTools:

```js
await __planner.update((state) => {
  state.dailyPlan = [];
  state.planDay = '';
  state.papers.find((x) => x.id === 'cs-p1').examDate =
    __planner.iso(__planner.daysAgo(-8));
});
location.reload();
```

## Step 4: Generate the 8-day plan

After reload:
1. go to `Today`
2. click `Create suggested plan`
3. record the 4 topics shown

### Observed result
- `File handling`
- `Flowcharts`
- `Pseudo-code`
- `Inspector Calls`

### Interpretation
At 8 days, Computer Science stayed strong but no longer fully dominated. Another subject re-entered the plan.

## Pass / Fail

### Pass
- at 7 days: all 4 topics come from the urgent subject
- at 8 days: at least one competing subject re-enters the plan

### Fail
- 7 days and 8 days produce effectively identical full domination with no visible shift

## Verdict
This test passed.

The planner is treating:
- **7 days** as fully urgent
- **8 days** as less aggressive, allowing other subjects back into the plan

## Why this is a valid test

This scenario uses:
- one urgent subject (`cs-aqa`)
- two competing later subjects (`bio-aqa`, `eng-lit-aqa`)
- the same topic set across both runs

The only meaningful change is:
- `cs-p1` from **7 days** to **8 days**

So the difference in output is evidence that the exact urgent boundary is working.

## Restore original state

```js
await __planner.restore();
__planner.clearBackup();
location.reload();
```
