import type { Topic, Paper, Subject, Offering, ScoredTopic, DayPlan, UserState, ScheduleItem } from '../types'

export const MS_PER_DAY = 1000 * 60 * 60 * 24
export const TOTAL_BLOCKS = 4
export const CRUNCH_DAYS_THRESHOLD = 21

export type PlanningMode = 'normal' | 'crunch'

// -- Utilities --

export function toMidnightUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function daysRemaining(examISO: string, today: Date): number {
  const exam = toMidnightUTC(new Date(examISO))
  const now = toMidnightUTC(today)
  const diff = Math.ceil((exam.getTime() - now.getTime()) / MS_PER_DAY)
  return Math.max(1, diff)
}

export function examDayDiff(examISO: string, today: Date): number {
  const exam = toMidnightUTC(new Date(examISO))
  const now = toMidnightUTC(today)
  return Math.ceil((exam.getTime() - now.getTime()) / MS_PER_DAY)
}

export function formatExamCountdown(examISO: string, today: Date): string {
  const diff = examDayDiff(examISO, today)
  if (diff < 0) return 'Exam passed'
  if (diff === 0) return 'Exam today'
  return `Exam in ${diff} ${diff === 1 ? 'day' : 'days'}`
}

export function daysSince(lastISO: string | null, today: Date): number {
  if (!lastISO) return 0
  const last = toMidnightUTC(new Date(lastISO))
  const now = toMidnightUTC(today)
  const diff = Math.floor((now.getTime() - last.getTime()) / MS_PER_DAY)
  return Math.max(0, diff)
}

// -- Core Formulas --

export function weakness(perf: number, confidence: number): number {
  const confNorm = confidence / 5
  return 0.7 * (1 - perf) + 0.3 * (1 - confNorm)
}

export function urgency(paperExamISO: string, today: Date): number {
  return 1 / Math.sqrt(daysRemaining(paperExamISO, today))
}

export function recencyFactor(lastISO: string | null, today: Date): number {
  if (!lastISO) return 1.4
  const since = daysSince(lastISO, today)
  if (since === 0) return 0.5
  if (since <= 3) return 0.7
  if (since <= 6) return 0.85
  if (since <= 13) return 1.0
  if (since <= 20) return 1.15
  return 1.4
}

// -- Crunch Mode --

export function futurePapers(papers: Paper[], today: Date): Paper[] {
  const todayMid = toMidnightUTC(today)
  return papers.filter((p) => toMidnightUTC(new Date(p.examDate)) >= todayMid)
}

export function getPlanningMode(today: Date, papers: Paper[]): PlanningMode {
  const future = futurePapers(papers, today)
  if (future.length === 0) return 'normal'
  let nearest = Infinity
  for (const p of future) {
    const days = daysRemaining(p.examDate, today)
    if (days < nearest) nearest = days
  }
  return nearest <= CRUNCH_DAYS_THRESHOLD ? 'crunch' : 'normal'
}

export function nearestExamDays(today: Date, papers: Paper[]): number {
  const future = futurePapers(papers, today)
  let nearest = Infinity
  for (const p of future) {
    const days = daysRemaining(p.examDate, today)
    if (days < nearest) nearest = days
  }
  return nearest === Infinity ? 0 : nearest
}

export function examWindowBoost(days: number): number {
  if (days <= 3) return 1.6
  if (days <= 7) return 1.4
  if (days <= 14) return 1.2
  if (days <= 21) return 1.1
  return 1.0
}

export function notStartedBoost(topic: Topic, days: number): number {
  if (topic.lastReviewed !== null) return 1.0
  if (days <= 7) return 1.5
  if (days <= 14) return 1.3
  if (days <= 21) return 1.15
  return 1.0
}

export function coolingFactor(lastISO: string | null, today: Date, mode: PlanningMode): number {
  const base = recencyFactor(lastISO, today)
  if (mode === 'normal') return base
  // In crunch mode, soften the cooldown penalties so urgent weak gaps can resurface
  if (base < 1.0) return base + (1.0 - base) * 0.5 // halve the penalty
  return base
}

export function crunchTopicScore(
  topic: Topic,
  paper: Paper,
  today: Date,
  mode: PlanningMode,
): number {
  const w = weakness(topic.performanceScore, topic.confidence)
  const u = urgency(paper.examDate, today)
  const c = coolingFactor(topic.lastReviewed, today, mode)

  if (mode === 'normal') return w * u * c

  const days = daysRemaining(paper.examDate, today)
  return w * u * c * examWindowBoost(days) * notStartedBoost(topic, days)
}

export function topicScore(
  perf: number,
  confidence: number,
  paperExamISO: string,
  lastISO: string | null,
  today: Date,
): number {
  return weakness(perf, confidence) * urgency(paperExamISO, today) * recencyFactor(lastISO, today)
}

// -- Performance Updates --

export function updatePerformance(oldScore: number, sessionScore: number): number {
  return 0.7 * oldScore + 0.3 * sessionScore
}

export function adjustConfidence(conf: number, sessionScore: number): number {
  let next = conf
  if (sessionScore < 0.5) next -= 1
  if (sessionScore > 0.8) next += 1
  return Math.min(5, Math.max(1, next))
}

// -- Daily Load --

export function maxDeepBlocks(energy: number, stress: number): number {
  const base = Math.min(energy, 4)
  const penalty = stress >= 4 ? 1 : 0
  return Math.max(0, Math.min(4, base - penalty))
}

// -- Scoring --
// Resolves topic -> paper -> offering -> subject

export function scoreAllTopics(
  topics: Topic[],
  papers: Paper[],
  offerings: Offering[],
  subjects: Subject[],
  today: Date,
  mode: PlanningMode = 'normal',
): ScoredTopic[] {
  const paperMap = new Map(papers.map((p) => [p.id, p]))
  const offeringMap = new Map(offerings.map((o) => [o.id, o]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))

  const result: ScoredTopic[] = []

  for (const topic of topics) {
    const paper = paperMap.get(topic.paperId)
    if (!paper) continue
    const offering = offeringMap.get(topic.offeringId)
    if (!offering) continue
    const subject = subjectMap.get(offering.subjectId)
    if (!subject) continue
    if (toMidnightUTC(today) > toMidnightUTC(new Date(paper.examDate))) continue

    result.push(scoreSingleTopic(topic, paper, offering, subject, today, mode))
  }

  return result
}

// -- Sorting --

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

export function sortTopicsByWeakness(topics: ScoredTopic[]): ScoredTopic[] {
  return [...topics].sort((a, b) => {
    if (b.weakness !== a.weakness) return b.weakness - a.weakness
    if (a.topic.confidence !== b.topic.confidence) return a.topic.confidence - b.topic.confidence
    if (a.topic.performanceScore !== b.topic.performanceScore) {
      return a.topic.performanceScore - b.topic.performanceScore
    }
    if (b.recencyFactor !== a.recencyFactor) return b.recencyFactor - a.recencyFactor
    if (b.score !== a.score) return b.score - a.score
    return a.topic.name.localeCompare(b.topic.name)
  })
}

// -- Subject Diversity --
// Diversity is grouped by generic subjectId, not offeringId

const MAX_PER_SUBJECT = 2
const URGENT_DAYS_THRESHOLD = 7

export function subjectCap(days: number, mode: PlanningMode): number {
  const urgent = days <= URGENT_DAYS_THRESHOLD
  // Urgent papers: no cap in either mode (original behavior preserved)
  if (urgent) return Infinity
  // Non-urgent in crunch mode: relax from 2 → 3
  if (mode === 'crunch') return 3
  return MAX_PER_SUBJECT
}

export function diversifyTopics(sorted: ScoredTopic[], limit: number, today: Date, mode: PlanningMode = 'normal'): ScoredTopic[] {
  const selected: ScoredTopic[] = []
  const subjectCount = new Map<string, number>()

  for (const t of sorted) {
    if (selected.length >= limit) break
    const sid = t.subject.id
    const count = subjectCount.get(sid) ?? 0
    const days = daysRemaining(t.paper.examDate, today)

    if (count >= subjectCap(days, mode)) continue

    selected.push(t)
    subjectCount.set(sid, count + 1)
  }

  return selected
}

// -- Day Plan --

export function buildDayPlan(scoredTopics: ScoredTopic[], userState: UserState, today: Date, mode: PlanningMode = 'normal'): DayPlan {
  const sorted = sortScoredTopics(scoredTopics)
  const selected = diversifyTopics(sorted, TOTAL_BLOCKS, today, mode)
  const deepCount = maxDeepBlocks(userState.energyLevel, userState.stress)

  const deep = selected.slice(0, deepCount).map((t) => ({ ...t, blockType: 'deep' as const }))
  const recall = selected.slice(deepCount).map((t) => ({ ...t, blockType: 'recall' as const }))

  return { deep, recall }
}

// -- Single Topic Scoring --

export function scoreSingleTopic(
  topic: Topic,
  paper: Paper,
  offering: Offering,
  subject: Subject,
  today: Date,
  mode: PlanningMode = 'normal',
): ScoredTopic {
  const w = weakness(topic.performanceScore, topic.confidence)
  const r = recencyFactor(topic.lastReviewed, today)
  const score = mode === 'normal'
    ? topicScore(topic.performanceScore, topic.confidence, paper.examDate, topic.lastReviewed, today)
    : crunchTopicScore(topic, paper, today, mode)
  return { topic, paper, offering, subject, score, blockType: 'deep', weakness: w, recencyFactor: r }
}

// -- Suggestions --

export function getSuggestions(scored: ScoredTopic[], excludeTopicIds: Set<string>): ScoredTopic[] {
  return sortScoredTopics(scored)
    .filter((s) => !excludeTopicIds.has(s.topic.id))
    .slice(0, 6)
}

// -- Overdue Detection --

export const OVERDUE_RECENCY_THRESHOLD = 1.4
export const OVERDUE_WEAKNESS_THRESHOLD = 0.6

export function getOverdueTopics(scoredTopics: ScoredTopic[]): ScoredTopic[] {
  return scoredTopics.filter(
    (s) =>
      s.topic.lastReviewed !== null &&
      s.recencyFactor >= OVERDUE_RECENCY_THRESHOLD &&
      s.weakness >= OVERDUE_WEAKNESS_THRESHOLD,
  )
}

// -- Auto-Fill Plan --
// Diversity counter uses subject.id (generic), not offering

export function autoFillPlanItems(
  scored: ScoredTopic[],
  existingItems: ScheduleItem[],
  dayKey: string,
  now: number,
  today: Date = new Date(),
  mode: PlanningMode = 'normal',
): ScheduleItem[] {
  const remainingSlots = TOTAL_BLOCKS - existingItems.length
  if (remainingSlots <= 0) return []

  const scoredMap = new Map(scored.map((s) => [s.topic.id, s]))
  const existingTopicIds = new Set(existingItems.map((i) => i.topicId))

  const subjectCount = new Map<string, number>()
  for (const item of existingItems) {
    const resolved = scoredMap.get(item.topicId)
    if (resolved) {
      subjectCount.set(resolved.subject.id, (subjectCount.get(resolved.subject.id) ?? 0) + 1)
    }
  }

  const uniqueSubjects = new Set(scored.map((s) => s.subject.id)).size
  const fallbackMax = uniqueSubjects >= TOTAL_BLOCKS ? 2 : Math.ceil(TOTAL_BLOCKS / Math.max(1, uniqueSubjects))

  const result: ScheduleItem[] = []
  for (const candidate of sortScoredTopics(scored)) {
    if (result.length >= remainingSlots) break
    if (existingTopicIds.has(candidate.topic.id)) continue
    const sid = candidate.subject.id
    const days = daysRemaining(candidate.paper.examDate, today)
    const modeCap = subjectCap(days, mode)
    // Use whichever cap is more permissive, but never exceed TOTAL_BLOCKS
    const cap = Math.min(Math.max(modeCap, fallbackMax), TOTAL_BLOCKS)
    if ((subjectCount.get(sid) ?? 0) >= cap) continue

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
