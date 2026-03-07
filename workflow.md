# Scheduling Workflow — End-to-End

How the engine decides what a student studies each day, and how scores evolve across sessions.

---

## 1. Onboarding

Student selects offerings (subject + exam board combos) and sets an initial **confidence** (1-5) per offering. This confidence is applied uniformly to all topics within that offering.

All topics start with `performanceScore = 0` and `lastReviewed = null`.

---

## 2. Daily Scoring

Every time the plan screen renders, `scoreAllTopics` scores every topic across all selected offerings:

```
score = weakness x urgency x recencyFactor
```

### 2.1 Weakness (how bad you are at it)

```
weakness = 0.7 x (1 - performance) + 0.3 x (1 - confidence/5)
```

- performance in [0, 1], confidence in [1, 5]
- 70% weight on objective performance, 30% on self-reported confidence
- Range: 0 (fully mastered) to 1 (completely weak)

### 2.2 Urgency (how close the exam is)

```
urgency = 1 / sqrt(daysRemaining)
```

| Days Remaining | Urgency |
|----------------|---------|
| 25             | 0.20    |
| 4              | 0.50    |
| 1              | 1.00    |

Concave curve — gentle rise early, accelerating in the final week.

### 2.3 Recency Factor (how long since last review)

```
if never reviewed: 1.2 (max staleness)

recencyFactor = 1 + 0.2 x min(daysSince / 30, 1)
```

| Days Since | Factor |
|------------|--------|
| 0          | 1.00   |
| 7          | 1.05   |
| 15         | 1.10   |
| 23         | 1.15   |
| 30+        | 1.20   |

Max boost is 20%. This is a nudge, not a dominant force — weakness drives rankings.

---

## 3. Plan Construction

### 3.1 Sort all topics by score (descending)

Tiebreakers: lower performanceScore first, then alphabetical.

### 3.2 Diversity filter

Pick top 4 topics with a cap of **2 topics per subject**.

Exception: if a subject's exam is **< 7 days away**, the cap is lifted for that subject (cramming mode).

With 12 subjects, this guarantees at least 2 different subjects appear daily.

### 3.3 Deep vs Recall split

The 4 slots are split into "deep study" and "recall" blocks based on `maxDeepBlocks`:

```
base = min(energy, 4)
penalty = 1 if stress >= 4, else 0
deepBlocks = clamp(base - penalty, 0, 4)
recallBlocks = 4 - deepBlocks
```

Top-ranked topics get deep blocks; remainder get recall blocks.

---

## 4. Energy & Stress — Current State

`UserState` defines two fields:

```ts
energyLevel: number  // 1-5
stress: number       // 1-5
```

### How they affect the plan

| Energy | Stress | Deep Blocks | Recall Blocks |
|--------|--------|-------------|---------------|
| 3      | 2      | 3           | 1             |
| 3      | 4      | 2           | 2             |
| 1      | 5      | 0           | 4             |
| 5      | 1      | 4           | 0             |

- Energy directly controls how many deep blocks are available (capped at 4)
- High stress (>= 4) reduces deep blocks by 1 — shifting a slot to lighter recall

### How they are updated

**They are not.** The store exposes `setEnergy` and `setStress` actions, but no UI component calls them. The values are hardcoded at initialisation:

```
energyLevel: 3, stress: 2
```

This means every student always gets **3 deep + 1 recall** regardless of how they actually feel. The deep/recall split mechanism exists in the engine but is effectively inert.

---

## 5. Session Logging — How Scores Update

When a student completes a study session (`logSession`):

### 5.1 Performance update (exponential moving average)

```
newPerformance = 0.7 x oldPerformance + 0.3 x sessionScore
```

- sessionScore is the raw quiz score normalised to [0, 1]
- 70/30 blend preserves history while responding to recent performance
- A single great session won't erase a pattern of struggling

### 5.2 Confidence adjustment (step function)

```
if sessionScore < 0.5: confidence -= 1
if sessionScore > 0.8: confidence += 1
otherwise: no change
clamped to [1, 5]
```

Dead zone between 0.5-0.8 prevents jitter on average sessions.

### 5.3 Last reviewed

```
lastReviewed = today
```

This resets recencyFactor to 1.0, immediately deprioritising the topic.

---

## 6. Weak Topic Rotation — How Topics Come Back

There is no explicit rotation queue. Rotation is emergent from the scoring formula.

### Lifecycle of a weak topic ("Algebra", perf=0.3):

**Day 0 — Studied today:**
- lastReviewed = today, recencyFactor = 1.0
- Score drops relative to other topics
- Algebra leaves the plan; other topics take priority

**Days 1-22 — Absent from plan:**
- recencyFactor slowly climbs: 1.0 -> 1.05 -> 1.10
- Other weaker or more urgent topics still outrank it
- Algebra sits in the background gaining recency boost

**Day 23+ — Rotation candidate:**
- recencyFactor >= 1.15
- If weakness >= 0.6 (still struggling), flagged as **overdue** in NudgeBanner
- The combined score may now exceed other topics -> Algebra re-enters the plan

**Final week before exam:**
- Urgency spikes: 0.5 at 4 days, 1.0 at 1 day
- Diversity cap lifted within 7 days
- Weak topics for imminent exams dominate regardless of recency

### What actually drives rotation across 12 subjects

| Mechanism | Effect | Strength |
|-----------|--------|----------|
| Diversity cap (2/subject) | Forces variety across subjects | Strong — hard limit |
| Recency factor | Boosts neglected topics | Weak — max 20% boost |
| Urgency curve | Prioritises imminent exams | Strong near exam |
| Weakness | Keeps struggling topics high | Dominant signal |

The diversity cap is the primary rotation driver across subjects. Recency is a tiebreaker within topics of similar weakness.

---

## 7. Overdue Detection

A topic is flagged overdue when both conditions hold:

```
recencyFactor >= 1.15  (~23+ days without review)
weakness >= 0.6        (meaningfully struggling)
```

This identifies neglected AND weak topics. The NudgeBanner shows the count to prompt the student to revisit them.

---

## 8. Auto-Fill vs Manual Planning

- **Auto-fill:** `autoFillPlanItems` picks the highest-scored topics respecting diversity, skipping topics already in the tray
- **Manual:** Student can browse topics by subject and add/swap them into the 4-slot plan
- **Swap:** When the plan is full, the UI offers to swap out the lowest-scored (preferring auto-added) topic

---

## Summary

```
Onboarding (confidence set)
     |
     v
scoreAllTopics (weakness x urgency x recency)
     |
     v
diversify (max 2/subject, lifted <7 days to exam)
     |
     v
deep/recall split (energy - stress penalty) [currently fixed at 3/1]
     |
     v
Student studies a topic
     |
     v
logSession -> EMA performance, step confidence, reset lastReviewed
     |
     v
Topic deprioritised (recency=1.0) -> other topics surface
     |
     v
Over days, recency grows -> topic re-enters plan when score is competitive
```
