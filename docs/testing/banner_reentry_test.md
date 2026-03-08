# Banner Dismiss and Re-Entry Test

## Goal
Verify the banner priority and reset behavior:
- crunch banner appears first when crunch mode is active
- overdue banner appears only after crunch is dismissed
- leaving and re-entering crunch causes the crunch banner to reappear
- overdue can reappear again when banner state changes back

This proves the `NudgeBanner` state machine is behaving correctly.

## What this test checks

- crunch banner has higher priority than overdue
- dismissing crunch reveals overdue if overdue topics exist
- dismissed banners are not gone forever; they reset when state changes

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

## Step 1: Apply the banner-state setup

Run this in DevTools:

```js
await __planner.update((state) => {
  state.onboarded = true;
  state.selectedOfferingIds = ['cs-aqa', 'bio-aqa'];
  state.dailyPlan = [];
  state.planDay = '';

  const t = (id) => state.topics.find((x) => x.id === id);
  const p = (id) => state.papers.find((x) => x.id === id);

  // CS inside crunch
  p('cs-p1').examDate = __planner.iso(__planner.daysAgo(-13));
  p('cs-p2').examDate = __planner.iso(__planner.daysAgo(-19));

  // Biology outside crunch
  p('bio-p1').examDate = __planner.iso(__planner.daysAgo(-40));
  p('bio-p2').examDate = __planner.iso(__planner.daysAgo(-62));

  // Untouched urgent CS topics
  Object.assign(t('cs-001'), { lastReviewed: null, performanceScore: 0.5, confidence: 3 });
  Object.assign(t('cs-002'), { lastReviewed: null, performanceScore: 0.5, confidence: 3 });
  Object.assign(t('cs-003'), { lastReviewed: null, performanceScore: 0.5, confidence: 3 });

  // One overdue Biology topic
  Object.assign(t('bio-002'), {
    lastReviewed: __planner.iso(__planner.daysAgo(25)),
    performanceScore: 0.35,
    confidence: 2,
  });
});
location.reload();
```

## Step 2: Create the plan

After reload:
1. go to `Today`
2. click `Create suggested plan`

### Expected
- crunch banner appears
- overdue banner does not show yet

## Step 3: Dismiss crunch

Dismiss the crunch banner.

### Expected
- overdue banner appears
- it references the actual overdue topic / subject context

## Step 4: Dismiss overdue

Dismiss the overdue banner too.

### Expected
- no banner is visible

## Step 5: Exit crunch

Run this in DevTools:

```js
await __planner.update((state) => {
  state.dailyPlan = [];
  state.planDay = '';
  state.papers.find((x) => x.id === 'cs-p1').examDate =
    __planner.iso(__planner.daysAgo(-50));
  state.papers.find((x) => x.id === 'cs-p2').examDate =
    __planner.iso(__planner.daysAgo(-58));
});
location.reload();
```

Then:
1. go to `Today`
2. click `Create suggested plan` if needed

### Expected
- no crunch banner
- overdue may or may not appear depending on current snapshot and plan state

## Step 6: Re-enter crunch

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

Then:
1. go to `Today`
2. click `Create suggested plan` if needed

### Expected
- crunch banner reappears
- if dismissed again, overdue can reappear too

## Observed result

This scenario passed:
- crunch banner appeared first
- overdue appeared after crunch was dismissed
- re-entering crunch caused the crunch banner to reappear

## Pass / Fail

### Pass
- crunch appears first
- overdue appears after crunch dismissal
- re-entering crunch restores the crunch banner

### Fail
- overdue appears before crunch while crunch mode is active
- both banners show at the same time
- re-entering crunch does not restore the crunch banner

## Why this is a valid test

This scenario deliberately creates:
- a crunch-active Computer Science subject
- an overdue Biology topic

That forces both banner conditions to exist at the same time, which is the exact situation needed to verify banner priority and reset behavior.

## Restore original state

```js
await __planner.restore();
__planner.clearBackup();
location.reload();
```
