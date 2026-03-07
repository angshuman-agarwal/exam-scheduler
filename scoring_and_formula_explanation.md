# Scoring & Formula Design Document

Explains every formula in the scheduling engine (`src/lib/engine.ts`).

---

## 1. Time Normalisation — `toMidnightUTC(date)`

All dates are snapped to midnight UTC before comparison:

```
Date -> (year, month, day at 00:00 UTC)
```

This eliminates time-of-day noise so all calculations operate on whole-day units. Rankings stay stable throughout the day.

---

## 2. Days Remaining

```
daysRemaining = ceil((examDate - today) / MS_PER_DAY)
return max(1, daysRemaining)
```

Since both dates are already midnight-snapped, `ceil` is a safety net (the division is always exact). The `max(1)` clamp prevents division by zero in the urgency formula.

| Scenario       | Result |
|----------------|--------|
| Exam today     | 1      |
| Exam tomorrow  | 1      |
| Exam in 10 days| 10     |

---

## 3. Days Since (Staleness Base)

```
daysSince = floor((today - lastReviewed) / MS_PER_DAY)
return max(0, daysSince)
```

Like `ceil` above, `floor` is a safety net after midnight-snapping.

**Null handling:** If `lastReviewed` is null (never reviewed), `daysSince` returns 0. However, `recencyFactor` bypasses this entirely — see next section.

---

## 4. Recency Factor

```
if lastReviewed is null: return 1.2  (max staleness)

recencyFactor = 1 + 0.2 * min(daysSince / 30, 1)
```

| Days Since | Factor |
|------------|--------|
| 0          | 1.00   |
| 7          | 1.05   |
| 15         | 1.10   |
| 23+        | ~1.15+ |
| 30+        | 1.20   |
| null       | 1.20   |

**Key design decisions:**
- Never-reviewed topics get maximum staleness (1.2), bypassing `daysSince`
- Capped at 1.2 (20% max boost) so recency is a nudge, not a dominant force
- 30-day normalisation window matches typical GCSE monthly revision cycles

---

## 5. Urgency

```
urgency = 1 / sqrt(daysRemaining)
```

Square root produces a concave curve — gentle rise early, accelerating in the final week, capped at 1 on exam day.

| Days Remaining | Urgency |
|----------------|---------|
| 25             | 0.20    |
| 4              | 0.50    |
| 1              | 1.00    |

A linear `1/days` would spike too aggressively near the exam.

---

## 6. Weakness

```
weakness = 0.7 * (1 - performance) + 0.3 * (1 - confidence/5)
```

- Performance in [0, 1], confidence in [1, 5]
- 70/30 weighted blend favours objective performance over self-reported confidence
- Linear and continuous — no sharp jumps

---

## 7. Topic Score

```
score = weakness * urgency * recencyFactor
```

Multiplicative interaction: each dimension amplifies the others. If any dimension is near zero, the score collapses.

---

## 8. Overdue Detection

A topic is overdue when **both** conditions hold:

```
recencyFactor >= 1.15  (i.e. ~23+ days without review)
weakness >= 0.6
```

**Why two dimensions?**
- Recency alone would flag strong, well-mastered topics unnecessarily
- Weakness alone would flag frequently-reviewed weak topics incorrectly
- Together they identify **neglected AND weak** topics — high-impact blind spots

**Weakness >= 0.6 example:**
- perf=0.3, conf=2 -> weakness = 0.67 (overdue)
- perf=0.5, conf=3 -> weakness = 0.47 (not overdue)

---

## 9. Performance Updates

```
newPerformance = 0.7 * oldScore + 0.3 * sessionScore
```

Exponential moving average — recent sessions matter but history isn't discarded.

### Confidence Adjustment

```
if sessionScore < 0.5: confidence -= 1
if sessionScore > 0.8: confidence += 1
clamped to [1, 5]
```

Step-wise adjustment with a dead zone (0.5-0.8) where confidence stays unchanged.

---

## 10. Daily Load — `maxDeepBlocks`

```
base = min(energy, 4)
penalty = 1 if stress >= 4, else 0
return clamp(base - penalty, 0, 4)
```

High stress reduces deep study capacity by 1 block. Total blocks (deep + recall) is always capped at 4.

---

## 11. Subject Diversity

When building a day plan or auto-filling:
- Max 2 topics per subject (prevents tunnel-vision on one subject)
- Exception: if exam is < 7 days away, the cap is lifted for that subject

---

## 12. Stability Properties

1. Recency grows linearly, capped at 1.2
2. Urgency grows concavely (sqrt), capped at 1
3. Weakness is continuous and bounded in [0, 1]
4. Performance updates via exponential smoothing
5. No dimension is unbounded — no infinite spikes, no chaotic reordering
