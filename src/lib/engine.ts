import type { Topic, Paper, Subject, ScoredTopic, DayPlan, UserState, ScheduleItem } from '../types'

const MS_PER_DAY = 1000 * 60 * 60 * 24
export const TOTAL_BLOCKS = 4

// ── Utilities ──

export function toMidnightUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function daysRemaining(examISO: string, today: Date): number {
  const exam = toMidnightUTC(new Date(examISO))
  const now = toMidnightUTC(today)
  const diff = Math.ceil((exam.getTime() - now.getTime()) / MS_PER_DAY)
  return Math.max(1, diff)
}

export function daysSince(lastISO: string | null, today: Date): number {
  if (!lastISO) return 0
  const last = toMidnightUTC(new Date(lastISO))
  const now = toMidnightUTC(today)
  const diff = Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY)
  return Math.max(0, diff)
}

// ── Core Formulas ──

// Weighted blend of how poorly the student is doing on a topic.
// perf (0–1): rolling session performance score.
// confidence (1–5): student self-rated initially, then auto-adjusted after sessions.
// confNorm maps 1–5 → 0.2–1.0 so both inputs are on a 0–1 scale.
// 70% weight on actual performance, 30% on self-confidence — performance
// dominates because it's objective, but confidence captures "I understand it
// but keep making silly mistakes" vs "I genuinely don't get this".
// Output range: 0 (mastered) → 1 (completely weak).
export function weakness(perf: number, confidence: number): number {
  const confNorm = confidence / 5
  return 0.7 * (1 - perf) + 0.3 * (1 - confNorm)
}

// Inverse square-root of days until exam.
// Makes topics spike in priority as the exam approaches:
//   30 days → 0.18,  7 days → 0.38,  1 day → 1.0
// Square-root (not linear) avoids over-weighting far-off exams while still
// giving a meaningful boost as deadlines loom.
export function urgency(paperExamISO: string, today: Date): number {
  return 1 / Math.sqrt(daysRemaining(paperExamISO, today))
}

// Multiplier that boosts topics the student hasn't studied recently.
// Scales linearly from 1.0 (studied today) → 1.2 (30+ days ago), capped at 1.2.
// Never-studied topics get the max 1.2 — treated as 30+ days stale.
// The 0.2 range keeps it a gentle nudge (max 20% boost), not a hard override,
// so weakness and urgency remain the primary drivers.
export function recencyFactor(lastISO: string | null, today: Date): number {
  if (!lastISO) return 1.2
  const since = daysSince(lastISO, today)
  return 1 + 0.2 * Math.min(since / 30, 1)
}

// Combined priority score: weakness × urgency × recency.
// Multiplicative so all three must be non-trivial to rank high —
// a strong topic won't surface just because the exam is tomorrow,
// and a weak topic won't dominate if the exam is months away.
export function topicScore(
  perf: number,
  confidence: number,
  paperExamISO: string,
  lastISO: string | null,
  today: Date,
): number {
  return weakness(perf, confidence) * urgency(paperExamISO, today) * recencyFactor(lastISO, today)
}

// ── Performance Updates ──

// Exponential moving average: 70% historical, 30% latest session.
// Smooths out one-off bad/good sessions while still reacting to trends.
// A student scoring 1.0 on a topic at 0.0 moves to 0.3, not 1.0.
export function updatePerformance(oldScore: number, sessionScore: number): number {
  return 0.7 * oldScore + 0.3 * sessionScore
}

// Bumps confidence down on poor sessions (<50%) and up on strong ones (>80%).
// Clamped to [1, 5]. Middle-range sessions (50–80%) leave confidence unchanged.
// This auto-corrects over-/under-confident self-ratings over time.
export function adjustConfidence(conf: number, sessionScore: number): number {
  let next = conf
  if (sessionScore < 0.5) next -= 1
  if (sessionScore > 0.8) next += 1
  return Math.min(5, Math.max(1, next))
}

// ── Daily Load ──

// Caps deep-study blocks based on energy (1–5) and stress (1–5).
// Base = energy level (max 4 blocks), minus 1 if stress is high (≥4).
// Prevents burnout: a tired, stressed student gets fewer deep blocks
// and more lightweight recall blocks instead.
export function maxDeepBlocks(energy: number, stress: number): number {
  const base = Math.min(energy, 4)
  const penalty = stress >= 4 ? 1 : 0
  return Math.max(0, Math.min(4, base - penalty))
}

// ── Scoring ──

export function scoreAllTopics(
  topics: Topic[],
  papers: Paper[],
  subjects: Subject[],
  today: Date,
): ScoredTopic[] {
  const paperMap = new Map(papers.map((p) => [p.id, p]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))

  const result: ScoredTopic[] = []

  for (const topic of topics) {
    const paper = paperMap.get(topic.paperId)
    const subject = subjectMap.get(topic.subjectId)
    if (!paper || !subject) continue
    if (toMidnightUTC(today) > toMidnightUTC(new Date(paper.examDate))) continue

    const w = weakness(topic.performanceScore, topic.confidence)
    const r = recencyFactor(topic.lastReviewed, today)
    const u = urgency(paper.examDate, today)
    const score = w * u * r

    result.push({ topic, paper, subject, score, blockType: 'deep', weakness: w, recencyFactor: r })
  }

  return result
}

// ── Sorting ──

export function sortScoredTopics(topics: ScoredTopic[]): ScoredTopic[] {
  return [...topics].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.topic.performanceScore !== b.topic.performanceScore)
      return a.topic.performanceScore - b.topic.performanceScore
    if (a.topic.name < b.topic.name) return -1
    if (a.topic.name > b.topic.name) return 1
    return 0
  })
}

// ── Subject Diversity ──

// Prevents the plan from being dominated by one subject.
// Max 2 topics per subject unless the exam is within 7 days —
// cramming override: if your exam is next week, subject variety takes a back seat.
const MAX_PER_SUBJECT = 2
const URGENT_DAYS_THRESHOLD = 7

export function diversifyTopics(sorted: ScoredTopic[], limit: number, today: Date): ScoredTopic[] {
  const selected: ScoredTopic[] = []
  const subjectCount = new Map<string, number>()

  for (const t of sorted) {
    if (selected.length >= limit) break
    const sid = t.subject.id
    const count = subjectCount.get(sid) ?? 0
    const days = daysRemaining(t.paper.examDate, today)

    if (count >= MAX_PER_SUBJECT && days >= URGENT_DAYS_THRESHOLD) continue

    selected.push(t)
    subjectCount.set(sid, count + 1)
  }

  return selected
}

// ── Day Plan ──

// Builds a balanced study plan: sorts by priority, diversifies across subjects,
// then splits into deep-study vs recall blocks based on the student's energy/stress.
// High-priority topics get deep blocks; overflow gets lighter recall blocks.
export function buildDayPlan(scoredTopics: ScoredTopic[], userState: UserState, today: Date): DayPlan {
  const sorted = sortScoredTopics(scoredTopics)
  const selected = diversifyTopics(sorted, TOTAL_BLOCKS, today)
  const deepCount = maxDeepBlocks(userState.energyLevel, userState.stress)

  const deep = selected.slice(0, deepCount).map((t) => ({ ...t, blockType: 'deep' as const }))
  const recall = selected.slice(deepCount).map((t) => ({ ...t, blockType: 'recall' as const }))

  return { deep, recall }
}

// ── Suggestions ──

export function getSuggestions(scored: ScoredTopic[], excludeTopicIds: Set<string>): ScoredTopic[] {
  return sortScoredTopics(scored)
    .filter((s) => !excludeTopicIds.has(s.topic.id))
    .slice(0, 6)
}

// ── Overdue Detection ──

// Flags topics that are both weak AND neglected — "falling through the cracks".
// recency ≥ 1.15 → not studied in ~22+ days (0.15/0.2 × 30 ≈ 22.5), or never studied.
// weakness ≥ 0.6 → genuinely struggling (e.g. perf ~0.4, confidence ~2).
// Both must be true — a stale topic the student aces isn't overdue,
// and a weak topic studied yesterday isn't neglected.
export const OVERDUE_RECENCY_THRESHOLD = 1.15
export const OVERDUE_WEAKNESS_THRESHOLD = 0.6

export function getOverdueTopics(scoredTopics: ScoredTopic[]): ScoredTopic[] {
  return scoredTopics.filter(
    (s) => s.recencyFactor >= OVERDUE_RECENCY_THRESHOLD && s.weakness >= OVERDUE_WEAKNESS_THRESHOLD,
  )
}

// ── Auto-Fill Plan ──

// Fills remaining plan slots (up to TOTAL_BLOCKS) with the highest-priority
// topics not already in the plan, respecting the 2-per-subject diversity cap.
// Seeds the subject counter from existing tray items so auto-fill doesn't
// stack a third topic from a subject the student already picked manually.
export function autoFillPlanItems(
  scored: ScoredTopic[],
  existingItems: ScheduleItem[],
  dayKey: string,
  now: number,
): ScheduleItem[] {
  const remainingSlots = TOTAL_BLOCKS - existingItems.length
  if (remainingSlots <= 0) return []

  const scoredMap = new Map(scored.map((s) => [s.topic.id, s]))
  const existingTopicIds = new Set(existingItems.map((i) => i.topicId))

  // Seed subject counter from existing tray items
  const subjectCount = new Map<string, number>()
  for (const item of existingItems) {
    const resolved = scoredMap.get(item.topicId)
    if (resolved) {
      subjectCount.set(resolved.subject.id, (subjectCount.get(resolved.subject.id) ?? 0) + 1)
    }
  }

  const result: ScheduleItem[] = []
  for (const candidate of sortScoredTopics(scored)) {
    if (result.length >= remainingSlots) break
    if (existingTopicIds.has(candidate.topic.id)) continue
    const sid = candidate.subject.id
    if ((subjectCount.get(sid) ?? 0) >= 2) continue

    result.push({
      id: `si-${now}-${result.length}`,
      topicId: candidate.topic.id,
      source: 'auto',
      addedAt: now,
      dayKey,
    })
    subjectCount.set(sid, (subjectCount.get(sid) ?? 0) + 1)
  }

  return result
}
