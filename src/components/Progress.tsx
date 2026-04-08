import { useEffect, useMemo, useRef, useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { getLocalDayKey, msUntilNextLocalMidnight } from '../lib/date'
import { useLocalProgressApi } from '../lib/api/local/useProgressApi'
import { ExamDaySelectionPanel } from './ExamDaySelectionPanel'
import QualificationChip from './QualificationChip'
import type { Offering, Paper, PaperAttempt, Session, Subject } from '../types'
import {
  buildStudyVelocitySeries,
  buildLastSessionSummary,
  buildProgressCalendarDayMeta,
  buildProgressTableRows,
  nearestExamDaysForPapers,
  sortProgressTableRows,
  type ProgressTableFilter,
} from './progress/analytics'
import { ProgressCardsRow, type PaperAttemptDigestGroup } from './progress/ProgressOverviewCards'
import { ProgressCalendarCard } from './progress/ProgressCalendarCard'
import { ProgressTopicBreakdown } from './progress/ProgressTopicBreakdown'

interface ProgressProps {
  onGoToToday: () => void
  onBrowseOffering: (offering: Offering, subject: Subject, paper?: Paper | null) => void
  onStartPaperSession: (paper: Paper, offering: Offering, subject: Subject) => void
  onPlanNowTopic: (offering: Offering, subject: Subject, topicId: string) => void
}

function studyStreak(sessions: Session[], paperAttempts: PaperAttempt[], today: Date): number {
  const dates = new Set([
    ...sessions.map((session) => session.date),
    ...paperAttempts.map((attempt) => attempt.date),
  ])
  const cursor = new Date(today)
  let streak = 0

  if (!dates.has(getLocalDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }

  while (dates.has(getLocalDayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

function sessionsInWindow(sessions: Session[], paperAttempts: PaperAttempt[], today: Date, daysBack: number): Array<Session | PaperAttempt> {
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - daysBack)
  const cutoffISO = getLocalDayKey(cutoff)
  return [
    ...sessions.filter((session) => session.date > cutoffISO),
    ...paperAttempts.filter((attempt) => attempt.date > cutoffISO),
  ]
}

function streakDeltaText(sessions: Session[], paperAttempts: PaperAttempt[], today: Date): string {
  const thisWeek = sessionsInWindow(sessions, paperAttempts, today, 7)
  const lastWeekCutoff = new Date(today)
  lastWeekCutoff.setDate(lastWeekCutoff.getDate() - 14)
  const lastWeekStart = getLocalDayKey(lastWeekCutoff)
  const currentWeekStart = new Date(today)
  currentWeekStart.setDate(currentWeekStart.getDate() - 7)
  const currentWeekStartISO = getLocalDayKey(currentWeekStart)

  const previousWeekDates = new Set(
    [
      ...sessions
        .filter((session) => session.date > lastWeekStart && session.date <= currentWeekStartISO)
        .map((session) => session.date),
      ...paperAttempts
        .filter((attempt) => attempt.date > lastWeekStart && attempt.date <= currentWeekStartISO)
        .map((attempt) => attempt.date),
    ],
  )

  const recentDates = new Set(thisWeek.map((session) => session.date))
  const delta = recentDates.size - previousWeekDates.size

  if (delta > 0) return `+${delta} day${delta === 1 ? '' : 's'} vs last week`
  if (delta < 0) return `${delta} days vs last week`
  if (recentDates.size > 0) return 'Steady vs last week'
  return 'Start this week'
}

function buildExamDateMap(
  papers: Paper[],
  offerings: Offering[],
  subjects: Subject[],
): Map<string, { paper: Paper; subject: Subject; offering: Offering }[]> {
  const offeringMap = new Map(offerings.map((offering) => [offering.id, offering]))
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]))
  const dateMap = new Map<string, { paper: Paper; subject: Subject; offering: Offering }[]>()

  for (const paper of papers) {
    const offering = offeringMap.get(paper.offeringId)
    if (!offering) continue
    const subject = subjectMap.get(offering.subjectId)
    if (!subject) continue
    const existing = dateMap.get(paper.examDate) ?? []
    existing.push({ paper, subject, offering })
    dateMap.set(paper.examDate, existing)
  }

  return dateMap
}

function formatSelectedDateLabel(dateKey: string) {
  return `Reviewed on ${new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })}`
}

function formatPaperAttemptDate(dateKey: string) {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}

function formatDateRangeLabel(startKey: string, endKey: string) {
  const start = new Date(`${startKey}T00:00:00`)
  const end = new Date(`${endKey}T00:00:00`)
  const startDay = start.toLocaleDateString('en-GB', { day: 'numeric' })
  const startMonth = start.toLocaleDateString('en-GB', { month: 'short' })
  const endDay = end.toLocaleDateString('en-GB', { day: 'numeric' })
  const endMonth = end.toLocaleDateString('en-GB', { month: 'short' })

  if (startMonth === endMonth) return `${startDay} ${startMonth} - ${endDay} ${endMonth}`
  return `${startDay} ${startMonth} - ${endDay} ${endMonth}`
}

function formatPaperAttemptDetail(attempt: PaperAttempt) {
  const dateLabel = formatPaperAttemptDate(attempt.date)
  if (attempt.rawMark !== undefined && attempt.totalMarks !== undefined && attempt.totalMarks > 0) {
    const percent = Math.round((attempt.rawMark / attempt.totalMarks) * 100)
    return `${dateLabel} · Raw Marks ${attempt.rawMark}/${attempt.totalMarks} · ${percent}%`
  }
  return dateLabel
}

function buildPaperAttemptDigest(
  attempts: PaperAttempt[],
  papers: Paper[],
  offerings: Offering[],
  subjects: Subject[],
): PaperAttemptDigestGroup[] {
  const paperMap = new Map(papers.map((paper) => [paper.id, paper]))
  const offeringMap = new Map(offerings.map((offering) => [offering.id, offering]))
  const subjectMap = new Map(subjects.map((subject) => [subject.id, subject]))
  const byPaper = new Map<string, PaperAttempt[]>()

  for (const attempt of attempts) {
    const existing = byPaper.get(attempt.paperId) ?? []
    existing.push(attempt)
    byPaper.set(attempt.paperId, existing)
  }

  return Array.from(byPaper.entries())
    .map(([paperId, groupedAttempts]) => {
      const sortedAttempts = [...groupedAttempts].sort(
        (a, b) => b.timestamp - a.timestamp || b.date.localeCompare(a.date),
      )
      const latestAttempt = sortedAttempts[0]
      const paper = paperMap.get(paperId)
      if (!paper || !latestAttempt) return null
      const offering = offeringMap.get(paper.offeringId)
      if (!offering) return null
      const subject = subjectMap.get(offering.subjectId)
      if (!subject) return null

      return {
        key: paperId,
        title: `${subject.name} · ${paper.name}`,
        latestAttempt: {
          id: latestAttempt.id,
          detail: formatPaperAttemptDetail(latestAttempt),
        },
        olderAttempts: sortedAttempts.slice(1).map((attempt) => ({
          id: attempt.id,
          detail: formatPaperAttemptDetail(attempt),
        })),
        latestTimestamp: latestAttempt.timestamp,
      }
    })
    .filter((group): group is PaperAttemptDigestGroup & { latestTimestamp: number } => group !== null)
    .sort((a, b) => b.latestTimestamp - a.latestTimestamp)
    .map((group) => {
      const { latestTimestamp, ...rest } = group
      void latestTimestamp
      return rest
    })
}

export default function Progress({ onGoToToday, onBrowseOffering, onStartPaperSession, onPlanNowTopic }: ProgressProps) {
  const posthog = usePostHog()
  const { studyMode, topics, sessions, paperAttempts, subjects, papers, offerings, selectedOfferingIds, notes } = useLocalProgressApi()
  const [filter, setFilter] = useState<ProgressTableFilter>('priority-now')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const topicBreakdownRef = useRef<HTMLDivElement | null>(null)
  const [today, setToday] = useState(() => new Date())

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setToday(new Date())
    }, msUntilNextLocalMidnight(today))

    return () => window.clearTimeout(timeoutId)
  }, [today])

  const selectedOfferingSet = useMemo(() => new Set(selectedOfferingIds), [selectedOfferingIds])

  const selectedOfferings = useMemo(
    () => offerings.filter((offering) => selectedOfferingSet.has(offering.id)),
    [offerings, selectedOfferingSet],
  )
  const selectedOfferingIdSet = useMemo(() => new Set(selectedOfferings.map((offering) => offering.id)), [selectedOfferings])
  const selectedTopics = useMemo(
    () => topics.filter((topic) => selectedOfferingIdSet.has(topic.offeringId)),
    [topics, selectedOfferingIdSet],
  )
  const selectedPapers = useMemo(
    () => papers.filter((paper) => selectedOfferingIdSet.has(paper.offeringId)),
    [papers, selectedOfferingIdSet],
  )
  const selectedTopicIds = useMemo(() => new Set(selectedTopics.map((topic) => topic.id)), [selectedTopics])
  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedTopicIds.has(session.topicId)),
    [sessions, selectedTopicIds],
  )
  const selectedNotes = useMemo(
    () => notes.filter((note) => selectedTopicIds.has(note.topicId)),
    [notes, selectedTopicIds],
  )
  const selectedPaperIds = useMemo(() => new Set(selectedPapers.map((paper) => paper.id)), [selectedPapers])
  const selectedPaperAttempts = useMemo(
    () => paperAttempts.filter((attempt) => selectedPaperIds.has(attempt.paperId)),
    [paperAttempts, selectedPaperIds],
  )

  const futurePapers = useMemo(
    () => selectedPapers.filter((paper) => paper.examDate >= getLocalDayKey(today)),
    [selectedPapers, today],
  )
  const hasUpcomingExams = futurePapers.length > 0
  const hasStudyActivity = selectedSessions.length > 0 || selectedPaperAttempts.length > 0 || selectedNotes.length > 0
  const todayKey = getLocalDayKey(today)

  const streak = useMemo(() => studyStreak(selectedSessions, selectedPaperAttempts, today), [selectedPaperAttempts, selectedSessions, today])
  const thisWeekSessions = useMemo(() => sessionsInWindow(selectedSessions, selectedPaperAttempts, today, 7), [selectedPaperAttempts, selectedSessions, today])
  const paperAttemptsCount = selectedPaperAttempts.length
  const weeklyPaperAttemptsCount = useMemo(
    () => selectedPaperAttempts.filter((attempt) => {
      const attemptDate = new Date(`${attempt.date}T12:00:00`)
      const cutoff = new Date(today)
      cutoff.setDate(cutoff.getDate() - 7)
      return attemptDate > cutoff
    }).length,
    [selectedPaperAttempts, today],
  )
  const paperAttemptDigest = useMemo(
    () => buildPaperAttemptDigest(selectedPaperAttempts, selectedPapers, selectedOfferings, subjects),
    [selectedOfferings, selectedPaperAttempts, selectedPapers, subjects],
  )
  const totalStudyTime = useMemo(
    () =>
      selectedSessions.reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0)
      + selectedPaperAttempts.reduce((sum, attempt) => sum + attempt.durationSeconds, 0),
    [selectedPaperAttempts, selectedSessions],
  )
  const todayStudyTotal = useMemo(
    () =>
      selectedSessions
        .filter((session) => session.date === todayKey)
        .reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0)
      + selectedPaperAttempts
        .filter((attempt) => attempt.date === todayKey)
        .reduce((sum, attempt) => sum + attempt.durationSeconds, 0),
    [selectedPaperAttempts, selectedSessions, todayKey],
  )
  const selectedDayStudyTotal = useMemo(
    () => {
      if (!selectedDay) return 0
      return selectedSessions
        .filter((session) => session.date === selectedDay)
        .reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0)
        + selectedPaperAttempts
          .filter((attempt) => attempt.date === selectedDay)
          .reduce((sum, attempt) => sum + attempt.durationSeconds, 0)
    },
    [selectedDay, selectedPaperAttempts, selectedSessions],
  )
  const visibleRangeStudyTotal = useMemo(() => {
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() - 13)
    const cutoffKey = getLocalDayKey(cutoff)
    return selectedSessions
      .filter((session) => session.date >= cutoffKey && session.date <= todayKey)
      .reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0)
      + selectedPaperAttempts
        .filter((attempt) => attempt.date >= cutoffKey && attempt.date <= todayKey)
        .reduce((sum, attempt) => sum + attempt.durationSeconds, 0)
  }, [selectedPaperAttempts, selectedSessions, today, todayKey])
  const visibleRangeLabel = useMemo(() => {
    const start = new Date(today)
    start.setDate(start.getDate() - 13)
    return formatDateRangeLabel(getLocalDayKey(start), todayKey)
  }, [today, todayKey])
  const lastSession = useMemo(
    () => buildLastSessionSummary(selectedSessions, selectedTopics, selectedOfferings, subjects, selectedPapers, selectedPaperAttempts),
    [selectedOfferings, selectedPaperAttempts, selectedPapers, selectedSessions, selectedTopics, subjects],
  )
  const velocitySeries = useMemo(
    () => buildStudyVelocitySeries(selectedSessions, today, 14, selectedTopics, selectedOfferings, subjects, selectedPaperAttempts, selectedPapers),
    [selectedOfferings, selectedPaperAttempts, selectedPapers, selectedSessions, selectedTopics, subjects, today],
  )
  const progressRows = useMemo(
    () => buildProgressTableRows(selectedTopics, selectedOfferings, subjects, selectedPapers, today, selectedSessions, selectedPaperAttempts, selectedNotes),
    [selectedNotes, selectedOfferings, selectedPaperAttempts, selectedPapers, selectedSessions, selectedTopics, subjects, today],
  )
  const sortedRows = useMemo(() => sortProgressTableRows(progressRows, filter), [progressRows, filter])

  const examDateMap = useMemo(
    () => buildExamDateMap(selectedPapers, selectedOfferings, subjects),
    [selectedPapers, selectedOfferings, subjects],
  )
  const calendarDayMeta = useMemo(
    () => buildProgressCalendarDayMeta(selectedSessions, selectedTopics, selectedOfferings, subjects, selectedNotes, selectedPaperAttempts, selectedPapers),
    [selectedNotes, selectedOfferings, selectedPaperAttempts, selectedPapers, selectedSessions, selectedTopics, subjects],
  )
  const nearestExamDays = useMemo(() => nearestExamDaysForPapers(futurePapers, today), [futurePapers, today])
  const selectedDayPapers = useMemo(() => (selectedDay ? examDateMap.get(selectedDay) ?? [] : []), [examDateMap, selectedDay])
  const selectedDayHasFutureExam = !!selectedDay && selectedDay > todayKey && selectedDayPapers.length > 0
  const activityByDate = useMemo(() => {
    const byDate = new Map<string, { topicIds: Set<string>; paperIds: Set<string> }>()

    for (const session of selectedSessions) {
      const next = byDate.get(session.date) ?? { topicIds: new Set<string>(), paperIds: new Set<string>() }
      next.topicIds.add(session.topicId)
      byDate.set(session.date, next)
    }

    for (const note of selectedNotes) {
      const next = byDate.get(note.date) ?? { topicIds: new Set<string>(), paperIds: new Set<string>() }
      next.topicIds.add(note.topicId)
      byDate.set(note.date, next)
    }

    for (const attempt of selectedPaperAttempts) {
      const next = byDate.get(attempt.date) ?? { topicIds: new Set<string>(), paperIds: new Set<string>() }
      next.paperIds.add(attempt.paperId)
      byDate.set(attempt.date, next)
    }

    return byDate
  }, [selectedNotes, selectedPaperAttempts, selectedSessions])

  const displayedRows = useMemo(() => {
    if (!selectedDay) return sortedRows
    const active = activityByDate.get(selectedDay)
    if (!active || (active.topicIds.size === 0 && active.paperIds.size === 0)) return []
    const daySessionsByTopic = new Map<string, typeof selectedSessions>()
    for (const session of selectedSessions) {
      if (session.date !== selectedDay) continue
      const existing = daySessionsByTopic.get(session.topicId) ?? []
      existing.push(session)
      daySessionsByTopic.set(session.topicId, existing)
    }
    return progressRows
      .filter((row) => (row.kind === 'paper' ? active.paperIds.has(row.paper.id) : active.topicIds.has(row.topic.id)))
      .map((row) => {
        if (row.kind === 'paper') return row
        const daySessions = daySessionsByTopic.get(row.topic.id) ?? []
        if (daySessions.length === 0) {
          return {
            ...row,
            totalDurationSeconds: 0,
          }
        }
        const totalDurationSeconds = daySessions.reduce((sum, session) => sum + (session.durationSeconds ?? 0), 0)
        return {
          ...row,
          totalDurationSeconds,
        }
      })
      .sort((a, b) => {
        if (a.subject.name !== b.subject.name) return a.subject.name.localeCompare(b.subject.name)
        const aName = a.kind === 'paper' ? a.paper.name : a.topic.name
        const bName = b.kind === 'paper' ? b.paper.name : b.topic.name
        return aName.localeCompare(bName)
      })
  }, [activityByDate, progressRows, selectedDay, selectedSessions, sortedRows])

  const showTopicBreakdown = !selectedDay || displayedRows.length > 0 || !selectedDayHasFutureExam
  const recentlyReviewedLabel = selectedDay && displayedRows.length > 0 ? formatSelectedDateLabel(selectedDay) : 'Recently Reviewed'

  const showEmpty = !hasStudyActivity
  const showAnalytics = hasUpcomingExams && !showEmpty
  const handleSelectedDayChange = (nextSelectedDay: string | null) => {
    setSelectedDay(nextSelectedDay)
    if (nextSelectedDay) {
      setFilter('recently-reviewed')
    }
  }

  const focusRecentlyReviewed = () => {
    setSelectedDay(null)
    setFilter('recently-reviewed')
    topicBreakdownRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
  }

  const calendarNode = (
    <ProgressCalendarCard
      examDateMap={examDateMap}
      dateMetaMap={calendarDayMeta}
      onSelectPaper={({ offering, subject, paper }) => onBrowseOffering(offering, subject, paper)}
      selectedDay={selectedDay}
      onSelectedDayChange={handleSelectedDayChange}
    />
  )

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f8fc_0%,#f3f5fa_100%)] px-4 pb-6 pt-5">
      <div className={`grid gap-3.5 ${showAnalytics ? 'xl:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
        <div className="min-w-0">
          <section
            data-testid="progress-hero"
            className="mb-4 rounded-[1.4rem] border border-black/[0.055] bg-white px-5 py-4.5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.055)] sm:px-6"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-[1.85rem] font-bold tracking-[-0.06em] text-gray-900">Performance Overview</h1>
                  {studyMode && <QualificationChip mode={studyMode} />}
                </div>
                <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-gray-500">
                  {showEmpty
                    ? 'Build momentum with one focused session and the rest of your analytics will start filling in.'
                    : streak > 1
                      ? `${streak} day streak. Keep the run going and review your strongest days in the calendar.`
                      : 'Real-time study signals and exam context across your selected subjects.'}
                </p>
              </div>

              {showEmpty && (
                <button
                  data-testid="progress-hero-cta"
                  onClick={onGoToToday}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2f7cff,#1f63d8)] px-4 text-[13px] font-semibold text-white shadow-[0_10px_22px_rgba(37,95,216,0.24)] transition-transform hover:translate-y-[-1px]"
                >
                  Plan today’s study
                </button>
              )}
            </div>

            {!showEmpty && (
              <div className="mt-3.5 flex flex-wrap items-center gap-2 text-[12px] font-medium text-gray-600">
                <button
                  type="button"
                  data-testid="progress-hero-recent-pill"
                  onClick={focusRecentlyReviewed}
                  className="inline-flex items-center rounded-full border border-[#2f7cff]/15 bg-[linear-gradient(180deg,#f2f7ff_0%,#e8f0ff_100%)] px-3 py-1.5 text-[#1f63d8] shadow-[0_6px_16px_rgba(37,95,216,0.12)] transition-transform hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7cff]/25"
                >
                  {thisWeekSessions.length} session{thisWeekSessions.length === 1 ? '' : 's'} this week
                </button>
                {nearestExamDays !== null && (
                  <button
                    type="button"
                    data-testid="progress-hero-next-exam-pill"
                    onClick={onGoToToday}
                    className="inline-flex items-center rounded-full border border-[#f59e0b]/20 bg-[linear-gradient(180deg,#fff8ea_0%,#fff1cf_100%)] px-3 py-1.5 text-[#b86a00] shadow-[0_6px_16px_rgba(217,119,6,0.12)] transition-transform hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b]/25"
                  >
                    Next exam in {nearestExamDays} day{nearestExamDays === 1 ? '' : 's'}
                  </button>
                )}
              </div>
            )}
          </section>

          {showEmpty && (
            <section
              data-testid="progress-empty-message"
              className="rounded-[1.4rem] border border-dashed border-black/[0.08] bg-black/[0.02] px-5 py-5 text-[14px] leading-6 text-gray-500"
            >
              No study sessions yet. Once you start revising, you’ll see streaks, session history, study velocity, and day-by-day calendar insights here.
            </section>
          )}

          {!showEmpty && !hasUpcomingExams && (
            <section
              data-testid="progress-no-upcoming"
              className="rounded-[1.4rem] border border-amber-300/40 bg-amber-50/70 px-5 py-4 text-[14px] leading-6 text-amber-900 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.04)]"
            >
              No upcoming exams in your selected subjects. Update your exam dates or add subjects to bring the calendar and readiness view back into focus.
            </section>
          )}

          {showAnalytics && (
            <>
              <ProgressCardsRow
                streak={streak}
                streakDeltaText={streakDeltaText(selectedSessions, selectedPaperAttempts, today)}
                paperAttemptsCount={paperAttemptsCount}
                weeklyPaperAttemptsCount={weeklyPaperAttemptsCount}
                paperAttemptDigest={paperAttemptDigest}
                totalStudyTime={totalStudyTime}
                lastSession={lastSession}
                today={today}
                todayStudyTotal={todayStudyTotal}
                velocitySummaryValue={selectedDay ? selectedDayStudyTotal : visibleRangeStudyTotal}
                velocitySummaryLabel={selectedDay ? formatPaperAttemptDate(selectedDay) : visibleRangeLabel}
                velocitySeries={velocitySeries}
                selectedDay={selectedDay}
                onSelectVelocityDay={(dateKey) => {
                  posthog?.capture('progress_velocity_click', { date: dateKey })
                  setSelectedDay((current) => (current === dateKey ? null : dateKey))
                  setFilter('recently-reviewed')
                }}
              />

              {selectedDayHasFutureExam && selectedDay && (
                <div className="mt-3.5">
                  <ExamDaySelectionPanel
                    selectedDay={selectedDay}
                    papers={selectedDayPapers}
                    onSelectPaper={(offering, subject, paper) => onBrowseOffering(offering, subject, paper)}
                    onStartPaper={(offering, subject, paper) => onStartPaperSession(paper, offering, subject)}
                    className="rounded-[1.4rem] border border-black/[0.055] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.055)]"
                  />
                </div>
              )}

              {showTopicBreakdown && (
                <div ref={topicBreakdownRef} className="mt-3" data-testid="progress-topic-breakdown-anchor">
                  <ProgressTopicBreakdown
                    rows={displayedRows}
                    filter={filter}
                    onFilterChange={setFilter}
                    onPlanNow={(row) => { posthog?.capture('progress_plan_now', { topic: row.topic.name, subject: row.subject.name }); onPlanNowTopic(row.offering, row.subject, row.topic.id) }}
                    recentlyReviewedLabel={recentlyReviewedLabel}
                    priorityDisabled={selectedDay !== null}
                    onClearReviewedDate={() => setSelectedDay(null)}
                  />
                </div>
              )}

              <div className="mt-3 hidden sm:block xl:hidden">
                {calendarNode}
              </div>
            </>
          )}
        </div>

        {showAnalytics && (
          <aside className="hidden xl:block xl:self-start">
            <div className="sticky top-6">
              {calendarNode}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
