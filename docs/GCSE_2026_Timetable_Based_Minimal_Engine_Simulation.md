
# GCSE Study Scheduler — 2026 Timetable Based Simulation
Minimal Engine Worked Examples (Multi‑Subject)

This document uses the real 2026 Higher Tier timetable.
Engine:

score = weakness × urgency × recencyFactor

weakness = 0.7*(1 - performanceScore) + 0.3*(1 - confidence/5)
urgency = 1 / sqrt(daysRemaining)
recencyFactor = piecewise cooldown:
  null (never reviewed) → 1.4
  0 days (today)        → 0.5
  1-3 days              → 0.7
  4-6 days              → 0.85
  7-13 days             → 1.0
  14-20 days            → 1.15
  21+ days              → 1.4

------------------------------------------------------------
ASSUMPTION

Today = 1 May 2026
DaysRemaining calculated to FIRST paper only.
------------------------------------------------------------

## 1️⃣ Exam Distance Table

| Subject              | First Paper | Days Remaining |
|----------------------|------------|----------------|
| Computer Science     | 11 May     | 10             |
| English Literature   | 11 May     | 10             |
| Biology              | 12 May     | 11             |
| Geography            | 13 May     | 12             |
| Maths                | 14 May     | 13             |
| Chemistry            | 18 May     | 17             |
| English Language     | 21 May     | 20             |
| Physics              | 2 June     | 32             |
| Spanish              | 9 June     | 39             |
| Additional Maths     | 16 June    | 46             |

------------------------------------------------------------

## 2️⃣ Urgency Table

| Subject            | Days | sqrt(days) | Urgency |
|--------------------|------|------------|---------|
| Computer Science   | 10   | 3.16       | 0.316   |
| English Literature | 10   | 3.16       | 0.316   |
| Biology            | 11   | 3.31       | 0.302   |
| Geography          | 12   | 3.46       | 0.289   |
| Maths              | 13   | 3.61       | 0.277   |
| Chemistry          | 17   | 4.12       | 0.243   |
| English Language   | 20   | 4.47       | 0.224   |
| Physics            | 32   | 5.66       | 0.177   |
| Spanish            | 39   | 6.24       | 0.160   |
| Additional Maths   | 46   | 6.78       | 0.147   |

------------------------------------------------------------

## 3️⃣ Micro Topic Calculations

### Topic A — Computer Science (Algorithms)

performanceScore = 0.6
confidence = 3
daysSince = 5 → band: 4-6 days

weakness = 0.7*(0.4) + 0.3*(0.4) = 0.40
urgency = 0.316
recencyFactor = 0.85

score = 0.40 × 0.316 × 0.85 = 0.107

---

### Topic B — English Literature (Macbeth)

performanceScore = 0.5
confidence = 3
daysSince = 8 → band: 7-13 days

weakness = 0.47
urgency = 0.316
recencyFactor = 1.0

score = 0.47 × 0.316 × 1.0 = 0.149

---

### Topic C — Biology (Cell Division)

performanceScore = 0.7
confidence = 4
daysSince = 2 → band: 1-3 days

weakness = 0.27
urgency = 0.302
recencyFactor = 0.7

score = 0.27 × 0.302 × 0.7 = 0.057

---

### Topic D — Maths (Algebra)

performanceScore = 0.4
confidence = 2
daysSince = 15 → band: 14-20 days

weakness = 0.60
urgency = 0.277
recencyFactor = 1.15

score = 0.60 × 0.277 × 1.15 = 0.191

---

### Topic E — Physics (Electricity)

performanceScore = 0.5
confidence = 3
daysSince = 30 → band: 21+ days

weakness = 0.47
urgency = 0.177
recencyFactor = 1.4

score = 0.47 × 0.177 × 1.4 = 0.116

---

### Topic F — Spanish (Speaking)

performanceScore = 0.8
confidence = 4
daysSince = 1 → band: 1-3 days

weakness = 0.20
urgency = 0.160
recencyFactor = 0.7

score = 0.20 × 0.160 × 0.7 = 0.022  

------------------------------------------------------------

## 4️⃣ Final Ranking

| Rank | Topic                          | Score | Recency Band |
|------|--------------------------------|-------|--------------|
| 1    | Maths — Algebra                | 0.191 | 14-20 days   |
| 2    | English Literature — Macbeth   | 0.149 | 7-13 days    |
| 3    | Physics — Electricity          | 0.116 | 21+ days     |
| 4    | Computer Science — Algorithms  | 0.107 | 4-6 days     |
| 5    | Biology — Cell Division        | 0.057 | 1-3 days     |
| 6    | Spanish — Speaking             | 0.022 | 1-3 days     |

------------------------------------------------------------

## 4.5 Illustration — How Piecewise Cooldown Flips Rankings

Physics Electricity was ranked #4 (old) but jumped to #3 (new).
CS Algorithms was ranked #3 (old) but dropped to #4 (new).
Both have similar weakness scores — the difference is entirely recency.

### Physics Electricity (30 days ago)

weakness = 0.47, urgency = 0.1768

| Model | Formula                              | recencyFactor | Score |
|-------|--------------------------------------|---------------|-------|
| Old   | 1 + 0.2 × min(30/30, 1) = 1 + 0.20  | 1.20          | 0.100 |
| New   | 30 days → 21+ band                   | 1.40          | 0.116 |

### CS Algorithms (5 days ago)

weakness = 0.40, urgency = 0.316

| Model | Formula                             | recencyFactor | Score |
|-------|-------------------------------------|---------------|-------|
| Old   | 1 + 0.2 × min(5/30, 1) = 1 + 0.033 | 1.033         | 0.130 |
| New   | 5 days → 4-6 band                   | 0.85          | 0.107 |

### What happened

Old model: CS (0.130) > Physics (0.100) — CS leads by 0.030
New model: Physics (0.116) > CS (0.107) — Physics leads by 0.009

Physics got a bigger boost (1.20 → 1.40) while CS got penalized (1.033 → 0.85).
The neglected topic surfaced and the recently-studied one cooled down —
exactly the rotation behavior the piecewise model was designed to produce.

------------------------------------------------------------

## 5️⃣ Daily Plan Example

TOTAL_BLOCKS = 4  
energyLevel = 3  
stress = 2  

Deep Blocks:
1. Maths — Algebra
2. English Literature — Macbeth
3. Physics — Electricity

Recall Block:
4. Computer Science — Algorithms  

------------------------------------------------------------

Result:

- Near exams dominate
- Weak topics rise
- Recently studied topics get a strong cooldown (0.5-0.7x)
- Forgotten topics (21+ days) get a 1.4x boost and resurface automatically
- Scores alone now drive rotation — diversity caps are a safety net, not the primary mechanism

Key difference from old linear model:
- Old range: [1.0, 1.2] — barely any differentiation
- New range: [0.5, 1.4] — 2.8x spread between just-studied and neglected
- Physics (30 days ago) now outranks CS (5 days ago) despite equal weakness, because the cooldown penalty on CS and the neglect boost on Physics create real separation

Engine stays simple. UI stays clean.

End of Simulation
