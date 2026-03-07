import type { Topic, Paper, Subject, Offering, ScoredTopic, DayPlan, UserState, ScheduleItem } from '../types'

const MS_PER_DAY = 1000 * 60 * 60 * 24
export const TOTAL_BLOCKS = 4

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
  if (!lastISO) return 1.2
  const since = daysSince(lastISO, today)
  return 1 + 0.2 * Math.min(since / 30, 1)
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

    result.push(scoreSingleTopic(topic, paper, offering, subject, today))
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

// -- Subject Diversity --
// Diversity is grouped by generic subjectId, not offeringId

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

// -- Day Plan --

export function buildDayPlan(scoredTopics: ScoredTopic[], userState: UserState, today: Date): DayPlan {
  const sorted = sortScoredTopics(scoredTopics)
  const selected = diversifyTopics(sorted, TOTAL_BLOCKS, today)
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
): ScoredTopic {
  const w = weakness(topic.performanceScore, topic.confidence)
  const r = recencyFactor(topic.lastReviewed, today)
  const score = topicScore(topic.performanceScore, topic.confidence, paper.examDate, topic.lastReviewed, today)
  return { topic, paper, offering, subject, score, blockType: 'deep', weakness: w, recencyFactor: r }
}

// -- Suggestions --

export function getSuggestions(scored: ScoredTopic[], excludeTopicIds: Set<string>): ScoredTopic[] {
  return sortScoredTopics(scored)
    .filter((s) => !excludeTopicIds.has(s.topic.id))
    .slice(0, 6)
}

// -- Overdue Detection --

export const OVERDUE_RECENCY_THRESHOLD = 1.15
export const OVERDUE_WEAKNESS_THRESHOLD = 0.6

export function getOverdueTopics(scoredTopics: ScoredTopic[]): ScoredTopic[] {
  return scoredTopics.filter(
    (s) => s.recencyFactor >= OVERDUE_RECENCY_THRESHOLD && s.weakness >= OVERDUE_WEAKNESS_THRESHOLD,
  )
}

// -- Auto-Fill Plan --
// Diversity counter uses subject.id (generic), not offering

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

  const subjectCount = new Map<string, number>()
  for (const item of existingItems) {
    const resolved = scoredMap.get(item.topicId)
    if (resolved) {
      subjectCount.set(resolved.subject.id, (subjectCount.get(resolved.subject.id) ?? 0) + 1)
    }
  }

  const uniqueSubjects = new Set(scored.map((s) => s.subject.id)).size
  const maxPerSubject = uniqueSubjects >= TOTAL_BLOCKS ? 2 : Math.ceil(TOTAL_BLOCKS / Math.max(1, uniqueSubjects))

  const result: ScheduleItem[] = []
  for (const candidate of sortScoredTopics(scored)) {
    if (result.length >= remainingSlots) break
    if (existingTopicIds.has(candidate.topic.id)) continue
    const sid = candidate.subject.id
    if ((subjectCount.get(sid) ?? 0) >= maxPerSubject) continue

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
