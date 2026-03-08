# Urgent Dominance Scenario Test

## Goal
Verify that when one subject's nearest exam is within 7 days, the planner strongly favors that subject and surfaces its urgent untouched or weak topics ahead of calmer subjects.

This proves the very-close urgent behavior is working, beyond general crunch mode.

## What this test checks

- `Crunch mode` activates
- the urgent subject dominates the suggested plan
- untouched and weak urgent topics rise strongly
- the planner is less balanced than normal on purpose because urgency now matters more

## Prerequisites

- Be on a working app state after onboarding
- Have the `__planner` helper available in DevTools
- If needed, restore previous scenario state first

## Step 0: Restore previous test state if needed

```js
await __planner.restore();
__planner.clearBackup();
location.reload();
```

If reload clears the helper, re-run the helper snippet from `cooldown_test_steps.md`.

## Step 1: Apply the urgent-dominance setup

Run this in DevTools:

```js
await __planner.update((state) => {
  state.onboarded = true;
  state.selectedOfferingIds = ['maths-edexcel', 'bio-aqa', 'eng-lit-aqa'];
  state.dailyPlan = [];
  state.planDay = '';

  const t = (id) => state.topics.find((x) => x.id === id);
  const p = (id) => state.papers.find((x) => x.id === id);

  // Maths becomes the urgent subject
  p('maths-p1').examDate = __planner.iso(__planner.daysAgo(-5));
  p('maths-p2').examDate = __planner.iso(__planner.daysAgo(-25));
  p('maths-p3').examDate = __planner.iso(__planner.daysAgo(-32));

  // Other subjects stay later
  p('bio-p1').examDate = __planner.iso(__planner.daysAgo(-30));
  p('bio-p2').examDate = __planner.iso(__planner.daysAgo(-62));
  p('eng-lit-p1').examDate = __planner.iso(__planner.daysAgo(-28));
  p('eng-lit-p2').examDate = __planner.iso(__planner.daysAgo(-40));

  // Maths topics: urgent and still incomplete
  Object.assign(t('maths-001'), {
    lastReviewed: null,
    performanceScore: 0.5,
    confidence: 3,
  });

  Object.assign(t('maths-004'), {
    lastReviewed: __planner.iso(__planner.daysAgo(16)),
    performanceScore: 0.35,
    confidence: 2,
  });

  Object.assign(t('maths-026'), {
    lastReviewed: null,
    performanceScore: 0.45,
    confidence: 3,
  });

  // Other subjects still somewhat weak, but less urgent
  Object.assign(t('bio-003'), {
    lastReviewed: __planner.iso(__planner.daysAgo(22)),
    performanceScore: 0.4,
    confidence: 2,
  });

  Object.assign(t('eng-lit-001'), {
    lastReviewed: __planner.iso(__planner.daysAgo(20)),
    performanceScore: 0.42,
    confidence: 2,
  });
});
location.reload();
```

## Step 2: Check before creating the plan

On `Today`, before clicking anything:

Expected:
- `Crunch mode` chip is visible
- no banner yet, because no plan exists

## Step 3: Create the suggested plan

Click:
- `Create suggested plan`

## Expected result

The plan should clearly favor Maths.

Likely Maths topics include:
- `Fractions, decimals and percentages`
- `Bounds and error intervals`
- `Algebraic proof`

You may still see one Biology or English topic, but Maths should dominate more than under normal rotation.

## Step 4: Complete the plan if relevant

If `Complete plan` is available, click it.

Expected:
- the planner continues favoring Maths strongly
- urgent Maths coverage stays dominant

## Pass / Fail

### Pass
- `Crunch mode` chip is visible
- no banner before plan creation
- suggested plan clearly favors Maths
- urgent Maths topics rise aggressively

### Fail
- Maths does not dominate despite being 5 days away
- planner remains balanced as if nothing urgent changed

## Why this is a valid test

This scenario isolates a subject with a very close exam and gives it:
- untouched topics
- weak topics
- more urgency than the comparison subjects

So if Maths dominates the suggested plan, the urgent-window behavior is working.

## Restore original state

```js
await __planner.restore();
__planner.clearBackup();
location.reload();
```
