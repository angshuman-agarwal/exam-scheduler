# Normal Mode vs Crunch Mode Cap Test

## Goal
Verify that the planner behaves differently in normal mode and crunch mode for the same strong subject:
- in normal mode, the subject is strong but balanced more tightly
- in crunch mode, the same subject is allowed to take more slots because urgency is elevated

This proves the tray-fill behavior behind the suggested plan actually changes with planning mode.

## What this test checks

- normal mode still applies stronger cross-subject balance
- crunch mode allows a stronger urgent-subject bias
- the generated plan changes meaningfully when the same subject moves inside the crunch window

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

## Step 1: Apply the normal-mode setup

Run this in DevTools:

```js
await __planner.update((state) => {
  state.onboarded = true;
  state.selectedOfferingIds = ['cs-aqa', 'bio-aqa', 'eng-lit-aqa'];
  state.dailyPlan = [];
  state.planDay = '';

  const t = (id) => state.topics.find((x) => x.id === id);
  const p = (id) => state.papers.find((x) => x.id === id);

  // CS outside crunch
  p('cs-p1').examDate = __planner.iso(__planner.daysAgo(-30));
  p('cs-p2').examDate = __planner.iso(__planner.daysAgo(-38));

  p('bio-p1').examDate = __planner.iso(__planner.daysAgo(-40));
  p('eng-lit-p1').examDate = __planner.iso(__planner.daysAgo(-42));

  // Make CS the strongest subject, but not urgent
  Object.assign(t('cs-001'), { lastReviewed: null, performanceScore: 0.45, confidence: 3 });
  Object.assign(t('cs-002'), { lastReviewed: null, performanceScore: 0.45, confidence: 3 });
  Object.assign(t('cs-003'), { lastReviewed: null, performanceScore: 0.45, confidence: 3 });
  Object.assign(t('cs-005'), { lastReviewed: __planner.iso(__planner.daysAgo(16)), performanceScore: 0.35, confidence: 2 });

  Object.assign(t('bio-002'), { lastReviewed: __planner.iso(__planner.daysAgo(18)), performanceScore: 0.42, confidence: 2 });
  Object.assign(t('bio-005'), { lastReviewed: __planner.iso(__planner.daysAgo(18)), performanceScore: 0.4, confidence: 2 });
  Object.assign(t('eng-lit-001'), { lastReviewed: __planner.iso(__planner.daysAgo(18)), performanceScore: 0.44, confidence: 2 });
});
location.reload();
```

## Step 2: Generate the normal-mode plan

After reload:
1. go to `Today`
2. click `Create suggested plan`
3. record the 4 topics shown

### Observed normal-mode result
- `Arrays`
- `Flowcharts`
- `Animal and plant organisation`
- `Breathing and circulatory system`

Mix:
- 2 Computer Science
- 2 Biology

### Interpretation
Computer Science was strong, but normal-mode balancing still spread the plan across subjects.

## Step 3: Move the same setup into crunch mode

Run this in DevTools:

```js
await __planner.update((state) => {
  state.dailyPlan = [];
  state.planDay = '';

  state.papers.find((x) => x.id === 'cs-p1').examDate =
    __planner.iso(__planner.daysAgo(-13));
  state.papers.find((x) => x.id === 'cs-p2').examDate =
    __planner.iso(__planner.daysAgo(-19));
});
location.reload();
```

## Step 4: Generate the crunch-mode plan

After reload:
1. go to `Today`
2. click `Create suggested plan`
3. record the 4 topics shown

### Observed crunch-mode result
- `Flowcharts`
- `Pseudo-code`
- `Sorting and searching algorithms`
- `Animal and plant organisation`

Mix:
- 3 Computer Science
- 1 Biology

### Interpretation
Once Computer Science moved inside the crunch window, it was allowed to take more of the plan.

## Pass / Fail

### Pass
- normal mode shows a more balanced mix
- crunch mode gives the urgent subject a larger share of the plan

### Fail
- both modes produce effectively the same balance
- crunch mode does not visibly increase urgent-subject dominance

## Verdict
This test passed.

It proves that crunch mode is affecting actual plan generation, not just showing a chip or banner.

## Why this is a valid test

This scenario keeps the same strong subject and the same general topic setup.
The only meaningful change is moving that subject from outside crunch to inside crunch.

So the difference in plan mix is evidence that planning mode is changing the tray-fill behavior correctly.

## Restore original state

```js
await __planner.restore();
__planner.clearBackup();
location.reload();
```
