import { MS_PER_DAY, daysRemaining, daysSince, recencyFactor as engineRecencyFactor, scoreAllTopics, toMidnightUTC } from '../../lib/engine'
import { getLocalDayKey } from '../../lib/date'
import type { Note, Offering, Paper, Session, Subject, Topic } from '../../types'

export interface MetricExplanation {
  title: string
  meaning: string
  detail: string
}

export interface AnalyticsMetric {
  label: string
  value: string
  sublabel: string
  explanation: MetricExplanation
  trendBars?: number[]
}

export interface SubjectAnalyticsSummary {
  offering: Offering
  subject: Subject
  topics: Topic[]
  papers: Paper[]
  sessions: Session[]
  notesCount: number
  nearestExamDays: number | null
  masteryPercent: number
  readinessPercent: number
  coveragePercent: number
  velocityDeltaPercent: number | null
  strongestTopic: Topic | null
  weakestTopic: Topic | null
  hiddenRiskTopic: Topic | null
  nextBestTopic: Topic | null
  latestSession: Session | null
}

export interface LastSessionSummary {
  session: Session | null
  topic: Topic | null
  subject: Subject | null
  offering: Offering | null
}

export interface ProgressCalendarDayMeta {
  dateKey: string
  sessionCount: number
  totalDurationSeconds: number
  averageScore: number | null
  notesCount: number
  topicsStudied: Topic[]
  subjects: Subject[]
}

export interface StudyVelocityPoint {
  dateKey: string
  shortLabel: string
  dayNumber: string
  value: number
  heightPercent: number
  segments: Array<{
    subjectId: string
    subjectName: string
    color: string
    sharePercent: number
    value: number
  }>
}

export interface StudyVelocitySeries {
  unitLabel: 'Minutes studied' | 'Sessions'
  points: StudyVelocityPoint[]
}

export type TopicTableStatus = 'Complete' | 'Revision Ready' | 'Priority Now' | 'Needs Focus' | 'Scheduled' | 'Not Started'

export interface TopicTableRow {
  topic: Topic
  subject: Subject
  offering: Offering
  masteryPercent: number
  lastSessionScore: number | null
  sessionTrend: 'up' | 'flat' | 'down' | null
  actionLabel: string
  actionReason: string | null
  freshnessRatio: number
  recencyLabel: string
  status: TopicTableStatus
  priorityScore: number
}

export type ProgressTableFilter = 'recently-reviewed' | 'priority-now'

export const METRIC_EXPLANATIONS: Record<'mastery' | 'readiness' | 'coverage' | 'velocity', MetricExplanation> = {
  mastery: {
    title: 'Mastery',
    meaning: 'This is not an exam mark.',
    detail: 'It reflects how secure this topic or subject currently looks based on your recent performance and confidence.',
  },
  readiness: {
    title: 'Exam Readiness',
    meaning: 'This is not a predicted grade.',
    detail: 'It reflects recent performance, confidence, how recently you revised, and how much of the subject you have covered.',
  },
  coverage: {
    title: 'Coverage',
    meaning: 'This is not a quality score.',
    detail: 'It shows how much of this subject you have reviewed so far.',
  },
  velocity: {
    title: 'Study Velocity',
    meaning: 'This is a trend, not a mark.',
    detail: 'It compares recent study volume with the previous week using logged duration when available, otherwise session count.',
  },
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function masteryRatio(topic: Topic): number {
  const weakness = 0.7 * (1 - topic.performanceScore) + 0.3 * (1 - topic.confidence / 5)
  return clamp(1 - weakness, 0, 1)
}

export function masteryPercent(topic: Topic): number {
  return Math.round(masteryRatio(topic) * 100)
}

export function freshnessRatio(lastReviewed: string | null, today: Date): number {
  const factor = engineRecencyFactor(lastReviewed, today)
  if (factor <= 0.5) return 1
  if (factor <= 0.7) return 0.8
  if (factor <= 0.85) return 0.65
  if (factor <= 1) return 0.5
  if (factor <= 1.15) return 0.3
  return 0
}

export function coverageRatio(topics: Topic[]): number {
  if (topics.length === 0) return 0
  const reviewed = topics.filter((topic) => topic.lastReviewed !== null).length
  return reviewed / topics.length
}

export function coveragePercent(topics: Topic[]): number {
  return Math.round(coverageRatio(topics) * 100)
}

export function readinessRatio(topics: Topic[], today: Date): number {
  if (topics.length === 0) return 0

  const masteryAverage = topics.reduce((sum, topic) => sum + masteryRatio(topic), 0) / topics.length
  const freshnessAverage = topics.reduce((sum, topic) => sum + freshnessRatio(topic.lastReviewed, today), 0) / topics.length
  const coverage = coverageRatio(topics)

  return clamp((0.55 * masteryAverage) + (0.25 * freshnessAverage) + (0.2 * coverage), 0, 1)
}

export function readinessPercent(topics: Topic[], today: Date): number {
  return Math.round(readinessRatio(topics, today) * 100)
}

export function studyVelocityDeltaPercent(sessions: Session[], today: Date): number | null {
  const todayISO = getLocalDayKey(today)
  const startRecent = new Date(today)
  startRecent.setDate(startRecent.getDate() - 7)
  const recentISO = getLocalDayKey(startRecent)

  const startPrevious = new Date(today)
  startPrevious.setDate(startPrevious.getDate() - 14)
  const previousISO = getLocalDayKey(startPrevious)

  const recent = sessions.filter((session) => session.date > recentISO && session.date <= todayISO)
  const previous = sessions.filter((session) => session.date > previousISO && session.date <= recentISO)

  const useDuration = [...recent, ...previous].some((session) => session.durationSeconds !== undefined)
  const recentValue = recent.reduce((sum, session) => sum + (useDuration ? (session.durationSeconds ?? 0) : 1), 0)
  const previousValue = previous.reduce((sum, session) => sum + (useDuration ? (session.durationSeconds ?? 0) : 1), 0)

  if (recentValue === 0 && previousValue === 0) return null
  if (previousValue === 0) return 100

  return Math.round(((recentValue - previousValue) / previousValue) * 100)
}

export function studyVelocityBars(sessions: Session[], today: Date, days = 6): number[] {
  const useDuration = sessions.some((session) => session.durationSeconds !== undefined)
  const dailyTotals = new Map<string, number>()

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(today)
    date.setDate(date.getDate() - offset)
    dailyTotals.set(getLocalDayKey(date), 0)
  }

  for (const session of sessions) {
    if (!dailyTotals.has(session.date)) continue
    const nextValue = (dailyTotals.get(session.date) ?? 0) + (useDuration ? (session.durationSeconds ?? 0) : 1)
    dailyTotals.set(session.date, nextValue)
  }

  const values = [...dailyTotals.values()]
  const maxValue = Math.max(...values, 0)

  if (maxValue === 0) return values.map(() => 0)
  return values.map((value) => Math.max(18, Math.round((value / maxValue) * 100)))
}

export function buildStudyVelocitySeries(
  sessions: Session[],
  today: Date,
  days = 14,
  topics: Topic[] = [],
  offerings: Offering[] = [],
  subjects: Subject[] = [],
): StudyVelocitySeries {
  const useDuration = sessions.some((session) => session.durationSeconds !== undefined)
  const dailyTotals = new Map<string, number>()
  const dailySubjectTotals = new Map<
    string,
    Map<string, { subjectName: string; color: string; value: number }>
  >()
  const orderedDateKeys: string[] = []
  const topicMap = new Map(topics.map((topic) => [topic.id, topic]))
  const offeringMap = new Map(offerings.map((offering) => [offering.id, offering]))
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]))

  for (let offset = days - 1; offset >= 0; offset--) {
    const date = new Date(today)
    date.setDate(date.getDate() - offset)
    const dateKey = getLocalDayKey(date)
    orderedDateKeys.push(dateKey)
    dailyTotals.set(dateKey, 0)
    dailySubjectTotals.set(dateKey, new Map())
  }

  for (const session of sessions) {
    if (!dailyTotals.has(session.date)) continue
    const nextRawValue = useDuration ? (session.durationSeconds ?? 0) / 60 : 1
    dailyTotals.set(session.date, (dailyTotals.get(session.date) ?? 0) + nextRawValue)

    const topic = topicMap.get(session.topicId)
    const offering = topic ? offeringMap.get(topic.offeringId) : undefined
    const subject = offering ? subjectMap.get(offering.subjectId) : undefined
    if (!subject) continue

    const subjectTotals = dailySubjectTotals.get(session.date)
    if (!subjectTotals) continue
    const existing = subjectTotals.get(subject.id)
    if (existing) {
      existing.value += nextRawValue
    } else {
      subjectTotals.set(subject.id, {
        subjectName: subject.name,
        color: subject.color,
        value: nextRawValue,
      })
    }
  }

  const values = orderedDateKeys.map((dateKey) => dailyTotals.get(dateKey) ?? 0)
  const maxValue = Math.max(...values, 0)

  return {
    unitLabel: useDuration ? 'Minutes studied' : 'Sessions',
    points: orderedDateKeys.map((dateKey, index) => {
      const date = new Date(`${dateKey}T00:00:00`)
      const value = Math.round(values[index] * 10) / 10
      return {
        dateKey,
        shortLabel: date.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 1),
        dayNumber: String(date.getDate()),
        value,
        heightPercent: maxValue === 0 ? 0 : Math.max(10, Math.round((value / maxValue) * 100)),
        segments: (() => {
          const subjectTotals = dailySubjectTotals.get(dateKey)
          if (!subjectTotals || subjectTotals.size === 0 || value === 0) return []
          return [...subjectTotals.entries()]
            .map(([subjectId, segment]) => ({
              subjectId,
              subjectName: segment.subjectName,
              color: segment.color,
              value: Math.round(segment.value * 10) / 10,
              sharePercent: (segment.value / value) * 100,
            }))
            .sort((a, b) => b.value - a.value || a.subjectName.localeCompare(b.subjectName))
        })(),
      }
    }),
  }
}

export function nearestExamDaysForPapers(papers: Paper[], today: Date): number | null {
  const futureDays = papers
    .map((paper) => daysRemaining(paper.examDate, today))
    .filter((days) => days > 0)
    .sort((a, b) => a - b)

  return futureDays.length > 0 ? futureDays[0] : null
}

export function recencyLabel(lastReviewed: string | null, today: Date): string {
  if (!lastReviewed) return 'Not yet reviewed'

  const todayISO = getLocalDayKey(today)
  if (lastReviewed === todayISO) return 'Today'

  const [ly, lm, ld] = lastReviewed.split('-').map(Number)
  const todayParts = todayISO.split('-').map(Number)
  const lastDate = new Date(ly, lm - 1, ld)
  const todayDate = new Date(todayParts[0], todayParts[1] - 1, todayParts[2])
  const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / 86400000)

  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) return `${diffDays} days ago`
  if (diffDays <= 13) return 'Last week'
  return `${diffDays} days ago`
}

export function confidenceEmojiScale(confidence: number): string[] {
  const scale = ['😟', '😕', '🙂', '😊', '🤩']
  return scale.map((emoji, index) => (index === confidence - 1 ? emoji : emoji))
}

export function strongestTopic(topics: Topic[]): Topic | null {
  if (topics.length === 0) return null
  return [...topics].sort((a, b) => {
    const masteryDiff = masteryRatio(b) - masteryRatio(a)
    if (masteryDiff !== 0) return masteryDiff
    return (b.lastReviewed ?? '').localeCompare(a.lastReviewed ?? '')
  })[0] ?? null
}

export function weakestTopic(topics: Topic[]): Topic | null {
  if (topics.length === 0) return null
  return [...topics].sort((a, b) => {
    const masteryDiff = masteryRatio(a) - masteryRatio(b)
    if (masteryDiff !== 0) return masteryDiff
    return a.name.localeCompare(b.name)
  })[0] ?? null
}

export function hiddenRiskTopic(topics: Topic[], today: Date): Topic | null {
  return (
    [...topics]
      .filter((topic) => topic.lastReviewed !== null)
      .sort((a, b) => {
        const scoreA = (1 - masteryRatio(a)) * (1 - freshnessRatio(a.lastReviewed, today))
        const scoreB = (1 - masteryRatio(b)) * (1 - freshnessRatio(b.lastReviewed, today))
        if (scoreB !== scoreA) return scoreB - scoreA
        return a.name.localeCompare(b.name)
      })[0] ?? null
  )
}

export function latestSessionForTopics(topicIds: Set<string>, sessions: Session[]): Session | null {
  return (
    [...sessions]
      .filter((session) => topicIds.has(session.topicId))
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0) || b.date.localeCompare(a.date))[0] ?? null
  )
}

function latestSessionForTopic(topicId: string, sessions: Session[]): Session | null {
  let best: Session | null = null
  for (const session of sessions) {
    if (session.topicId !== topicId) continue
    if (!best || (session.timestamp ?? 0) > (best.timestamp ?? 0)) {
      best = session
    }
  }
  return best
}

function actionLabelFor(status: TopicTableStatus): string {
  switch (status) {
    case 'Not Started':
      return 'Begin this topic'
    case 'Priority Now':
      return 'Study today'
    case 'Needs Focus':
      return 'Keep practising'
    case 'Revision Ready':
      return 'Ready to revise'
    case 'Complete':
      return 'Well covered'
    case 'Scheduled':
      return 'On track'
  }
}

function actionReasonFor(
  status: TopicTableStatus,
  topic: Topic,
  examDaysAway: number | null,
  today: Date,
): string | null {
  switch (status) {
    case 'Not Started':
      return 'not studied yet'
    case 'Priority Now':
      return examDaysAway !== null ? `exam in ${examDaysAway} day${examDaysAway === 1 ? '' : 's'}` : null
    case 'Needs Focus':
      return daysSince(topic.lastReviewed, today) > 14 ? 'not studied in a while' : 'still needs work'
    case 'Revision Ready':
      return 'solid and recently practised'
    case 'Complete':
      return 'reviewed recently'
    case 'Scheduled':
      return 'no urgent changes needed'
  }
}

export function statusForTopic(topic: Topic, priorityScore: number, today: Date): TopicTableStatus {
  const mastery = masteryPercent(topic)
  const freshness = freshnessRatio(topic.lastReviewed, today)

  if (topic.lastReviewed === null) return 'Not Started'
  if (mastery >= 80 && freshness >= 0.8) return 'Complete'
  if (priorityScore >= 0.12) return 'Priority Now'
  if (mastery < 60 || freshness <= 0.3) return 'Needs Focus'
  if (mastery >= 70) return 'Revision Ready'
  return 'Scheduled'
}

export function buildTopicTableRows(
  topics: Topic[],
  offerings: Offering[],
  subjects: Subject[],
  papers: Paper[],
  today: Date,
  sessions: Session[] = [],
): TopicTableRow[] {
  const scored = scoreAllTopics(topics, papers, offerings, subjects, today)
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]))
  const offeringMap = new Map(offerings.map((offering) => [offering.id, offering]))
  const scoreMap = new Map(scored.map((item) => [item.topic.id, item]))

  return topics
    .map((topic) => {
      const scoredTopic = scoreMap.get(topic.id)
      const offering = offeringMap.get(topic.offeringId)
      const subject = offering ? subjectMap.get(offering.subjectId) : undefined
      if (!scoredTopic || !offering || !subject) return null

      const priorityScore = scoredTopic.score
      const status = statusForTopic(topic, priorityScore, today)
      const latestSession = latestSessionForTopic(topic.id, sessions)
      const lastSessionScore = latestSession?.score ?? null
      const diff = lastSessionScore !== null ? lastSessionScore - topic.performanceScore : null
      const sessionTrend = diff === null ? null : diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'flat'
      const paper = papers.find((candidate) => candidate.id === topic.paperId)
      const rawDiff = paper?.examDate
        ? Math.ceil((toMidnightUTC(new Date(paper.examDate)).getTime() - toMidnightUTC(today).getTime()) / MS_PER_DAY)
        : null
      const examDaysAway = rawDiff !== null && rawDiff > 0 ? rawDiff : null
      const actionLabel = actionLabelFor(status)
      const actionReason = actionReasonFor(status, topic, examDaysAway, today)

      return {
        topic,
        subject,
        offering,
        masteryPercent: masteryPercent(topic),
        lastSessionScore,
        sessionTrend,
        actionLabel,
        actionReason,
        freshnessRatio: freshnessRatio(topic.lastReviewed, today),
        recencyLabel: recencyLabel(topic.lastReviewed, today),
        status,
        priorityScore,
      } satisfies TopicTableRow
    })
    .filter((row): row is TopicTableRow => row !== null)
}

export function sortTopicTableRows(rows: TopicTableRow[], filter: ProgressTableFilter): TopicTableRow[] {
  const sorted = [...rows]
  if (filter === 'recently-reviewed') {
    return sorted
      .filter((row) => row.topic.lastReviewed !== null)
      .sort((a, b) => {
        const aDate = a.topic.lastReviewed ?? ''
        const bDate = b.topic.lastReviewed ?? ''
        if (bDate !== aDate) return bDate.localeCompare(aDate)
        return a.topic.name.localeCompare(b.topic.name)
      })
  }

  return sorted.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore
    if (a.masteryPercent !== b.masteryPercent) return a.masteryPercent - b.masteryPercent
    return a.topic.name.localeCompare(b.topic.name)
  })
}

export function buildAnalyticsMetrics(
  topics: Topic[],
  sessions: Session[],
  today: Date,
): AnalyticsMetric[] {
  const mastery = topics.length > 0
    ? Math.round((topics.reduce((sum, topic) => sum + masteryPercent(topic), 0) / topics.length))
    : 0
  const readiness = readinessPercent(topics, today)
  const coverage = coveragePercent(topics)
  const velocity = studyVelocityDeltaPercent(sessions, today)
  const velocityBars = studyVelocityBars(sessions, today)

  return [
    {
      label: 'Mastery',
      value: `${mastery}%`,
      sublabel: 'Confidence + performance',
      explanation: METRIC_EXPLANATIONS.mastery,
    },
    {
      label: 'Exam Readiness',
      value: `${readiness}%`,
      sublabel: 'Strength + freshness + coverage',
      explanation: METRIC_EXPLANATIONS.readiness,
    },
    {
      label: 'Coverage',
      value: `${coverage}%`,
      sublabel: 'Reviewed topics so far',
      explanation: METRIC_EXPLANATIONS.coverage,
    },
    {
      label: 'Study Velocity',
      value: velocity === null ? '—' : `${velocity > 0 ? '+' : ''}${velocity}%`,
      sublabel: 'Vs last week',
      explanation: METRIC_EXPLANATIONS.velocity,
      trendBars: velocityBars,
    },
  ]
}

export function buildLastSessionSummary(
  sessions: Session[],
  topics: Topic[],
  offerings: Offering[],
  subjects: Subject[],
): LastSessionSummary {
  if (sessions.length === 0) {
    return {
      session: null,
      topic: null,
      subject: null,
      offering: null,
    }
  }

  const topicMap = new Map(topics.map((topic) => [topic.id, topic]))
  const offeringMap = new Map(offerings.map((offering) => [offering.id, offering]))
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]))
  const session = [...sessions].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0) || b.date.localeCompare(a.date))[0] ?? null
  if (!session) {
    return {
      session: null,
      topic: null,
      subject: null,
      offering: null,
    }
  }

  const topic = topicMap.get(session.topicId) ?? null
  const offering = topic ? offeringMap.get(topic.offeringId) ?? null : null
  const subject = offering ? subjectMap.get(offering.subjectId) ?? null : null

  return { session, topic, subject, offering }
}

export function buildProgressCalendarDayMeta(
  sessions: Session[],
  topics: Topic[],
  offerings: Offering[],
  subjects: Subject[],
  notes: Note[],
): Map<string, ProgressCalendarDayMeta> {
  const topicMap = new Map(topics.map((topic) => [topic.id, topic]))
  const offeringMap = new Map(offerings.map((offering) => [offering.id, offering]))
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]))
  const noteCountByDate = notes.reduce((map, note) => {
    map.set(note.date, (map.get(note.date) ?? 0) + 1)
    return map
  }, new Map<string, number>())

  const dayMap = new Map<string, ProgressCalendarDayMeta>()
  for (const session of sessions) {
    const topic = topicMap.get(session.topicId)
    if (!topic) continue
    const offering = offeringMap.get(topic.offeringId)
    const subject = offering ? subjectMap.get(offering.subjectId) : undefined
    if (!offering || !subject) continue

    const existing = dayMap.get(session.date) ?? {
      dateKey: session.date,
      sessionCount: 0,
      totalDurationSeconds: 0,
      averageScore: null,
      notesCount: noteCountByDate.get(session.date) ?? 0,
      topicsStudied: [],
      subjects: [],
    }

    existing.sessionCount += 1
    existing.totalDurationSeconds += session.durationSeconds ?? 0
    existing.averageScore = existing.averageScore === null
      ? session.score
      : ((existing.averageScore * (existing.sessionCount - 1)) + session.score) / existing.sessionCount
    if (!existing.topicsStudied.some((item) => item.id === topic.id)) existing.topicsStudied.push(topic)
    if (!existing.subjects.some((item) => item.id === subject.id)) existing.subjects.push(subject)

    dayMap.set(session.date, existing)
  }

  return dayMap
}

export function buildSubjectAnalyticsSummary(
  offering: Offering,
  subject: Subject,
  topics: Topic[],
  papers: Paper[],
  sessions: Session[],
  notesCount: number,
  allOfferings: Offering[],
  allSubjects: Subject[],
  allPapers: Paper[],
  today: Date,
): SubjectAnalyticsSummary {
  const topicIds = new Set(topics.map((topic) => topic.id))
  const scopedSessions = sessions.filter((session) => topicIds.has(session.topicId))
  const rows = buildTopicTableRows(topics, allOfferings, allSubjects, allPapers, today)
  const priorityRows = sortTopicTableRows(rows, 'priority-now')

  return {
    offering,
    subject,
    topics,
    papers,
    sessions: scopedSessions,
    notesCount,
    nearestExamDays: nearestExamDaysForPapers(papers, today),
    masteryPercent: topics.length > 0
      ? Math.round(topics.reduce((sum, topic) => sum + masteryPercent(topic), 0) / topics.length)
      : 0,
    readinessPercent: readinessPercent(topics, today),
    coveragePercent: coveragePercent(topics),
    velocityDeltaPercent: studyVelocityDeltaPercent(scopedSessions, today),
    strongestTopic: strongestTopic(topics),
    weakestTopic: weakestTopic(topics),
    hiddenRiskTopic: hiddenRiskTopic(topics, today),
    nextBestTopic: priorityRows[0]?.topic ?? null,
    latestSession: latestSessionForTopics(topicIds, scopedSessions),
  }
}

export function latestSessionScoreLabel(score: number): string {
  if (score >= 0.8) return 'Strong'
  if (score >= 0.6) return 'Solid'
  return 'Needs Focus'
}
