# Crunch and Overdue Banner Test

## What this test proves

This scenario verifies the banner priority system in `TodayPlan` and `NudgeBanner`:

1. `Crunch mode` activates when the nearest selected exam is within 21 days.
2. The crunch banner takes priority over the overdue banner.
3. The overdue banner is still present in the background if overdue topics exist, but it is hidden while crunch is active.
4. When the crunch banner is dismissed, the next eligible banner in the priority order becomes visible.

## Why dismissing one banner made another appear

The app does **not** treat the banners as unrelated independent alerts.
It treats them as a **priority stack**.

Current priority order:

1. Crunch banner
2. Overdue banner

That means:
- if crunch mode is active, the crunch banner is shown first
- if overdue topics also exist at the same time, they are still valid, but they are hidden behind crunch because crunch has higher priority
- when you dismiss crunch, the app re-evaluates what banner should be shown next
- since overdue topics still qualify, the overdue banner becomes visible

So dismissing crunch did **not create** the overdue condition.
It only revealed the next banner that was already eligible.

## In this specific scenario

You configured:
- `cs-aqa` papers inside the crunch window
- untouched CS topics, which made crunch mode meaningful
- `bio-002` as stale and weak enough to count as overdue

So after creating a plan:
- crunch banner appeared first because crunch has higher priority
- overdue did not show yet because it was suppressed by crunch

After you dismissed crunch:
- the app checked again
- crunch was dismissed for the current crunch snapshot
- overdue was still valid
- so overdue appeared next

## Why this is correct UX

This is the intended behavior because it avoids showing two stacked warning banners at once.

Instead, the page shows:
- the most important message first
- then the next one only if the first is dismissed or no longer applies

That keeps `Today` cleaner and easier to scan.

## What would be wrong

These would indicate a bug:
- overdue appears before crunch while crunch mode is active
- both banners appear at the same time
- dismissing crunch causes no banner to appear even though overdue topics still exist
- dismissing crunch permanently hides overdue when it still qualifies

## Pass criteria for this scenario

- Before plan creation:
  - crunch chip visible
  - no banner shown yet
- After creating the plan:
  - crunch banner visible
  - overdue hidden
- After dismissing crunch:
  - overdue banner visible
  - overdue copy references the actual overdue topic/subject

## Short explanation

Dismissing one banner made another appear because the banners are resolved by **priority**, not by independent rendering.
The overdue banner was already eligible; it was just hidden until the higher-priority crunch banner was dismissed.
