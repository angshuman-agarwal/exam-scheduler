import { useState, useMemo } from 'react'
import { useAppStore } from '../stores/app.store'
import { daysRemaining, toMidnightUTC } from '../lib/engine'
import { getLocalDayKey } from '../lib/date'
import type { Topic, Paper, Session, Subject, Offering, Note } from '../types'

// -- Helpers (kept) --

function formatDuration(seconds: number): string {
  if (seconds < 60) return '<1m'
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  if (h === 0) return `${m}m`
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function totalDurationSeconds(sessions: Session[]): number {
  return sessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0)
}

function sessionsInWindow(sessions: Session[], today: Date, daysBack: number): Session[] {
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - daysBack)
  const cutoffISO = getLocalDayKey(cutoff)
  return sessions.filter((s) => s.date > cutoffISO)
}

function topicToSubjectId(topicId: string, topicMap: Map<string, Topic>, offeringMap: Map<string, Offering>): string | undefined {
  const topic = topicMap.get(topicId)
  if (!topic) return undefined
  const offering = offeringMap.get(topic.offeringId)
  return offering?.subjectId
}

function studyStreak(sessions: Session[], today: Date): number {
  const dates = new Set(sessions.map((s) => s.date))
  let streak = 0
  const d = new Date(today)
  const todayISO = getLocalDayKey(d)
  if (!dates.has(todayISO)) d.setDate(d.getDate() - 1)
  while (true) {
    const iso = getLocalDayKey(d)
    if (!dates.has(iso)) break
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

function avgConfidence(topics: Topic[]): number {
  if (topics.length === 0) return 0
  return topics.reduce((sum, t) => sum + t.confidence, 0) / topics.length
}

function avgPerformance(topics: Topic[]): number {
  const reviewed = topics.filter((t) => t.lastReviewed !== null)
  if (reviewed.length === 0) return 0
  return reviewed.reduce((sum, t) => sum + t.performanceScore, 0) / reviewed.length
}

function coveragePct(topics: Topic[]): number {
  if (topics.length === 0) return 0
  return topics.filter((t) => t.lastReviewed !== null).length / topics.length
}

function earliestExamDate(papers: Paper[], today: Date): string | null {
  const now = toMidnightUTC(today)
  const future = papers.filter((p) => toMidnightUTC(new Date(p.examDate)) > now)
  if (future.length === 0) return null
  return future.reduce((earliest, p) => (p.examDate < earliest ? p.examDate : earliest), future[0].examDate)
}

function weakestTopics(topics: Topic[], n: number, todayISO: string): Topic[] {
  return topics
    .filter((t) => t.lastReviewed !== null && t.lastReviewed !== todayISO)
    .filter((t) =>
      t.performanceScore < 0.6 ||
      (t.performanceScore < 0.7 && t.confidence <= 2)
    )
    .sort((a, b) => {
      if (a.performanceScore !== b.performanceScore) return a.performanceScore - b.performanceScore
      if (a.confidence !== b.confidence) return a.confidence - b.confidence
      return a.name.localeCompare(b.name)
    })
    .slice(0, n)
}

function confidenceGap(topics: Topic[]): 'overconfident' | 'undervaluing' | null {
  const reviewed = topics.filter((t) => t.lastReviewed !== null)
  if (reviewed.length < 3) return null
  const confNorm = avgConfidence(reviewed) / 5
  const perf = avgPerformance(reviewed)
  const gap = confNorm - perf
  if (gap > 0.15) return 'overconfident'
  if (gap < -0.15) return 'undervaluing'
  return null
}

function focusSuggestion(
  topics: Topic[],
  papers: Paper[],
  topicMap: Map<string, Topic>,
  offeringMap: Map<string, Offering>,
  subjects: Subject[],
  todayISO: string,
  today: Date,
): { topicName: string; subjectName: string; subjectColor: string } | null {
  const now = toMidnightUTC(today)
  const futureTopics = topics.filter((t) => {
    const paper = papers.find((p) => p.id === t.paperId)
    return paper && toMidnightUTC(new Date(paper.examDate)) > now
  })
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))
  const weak = weakestTopics(futureTopics, 1, todayISO)
  if (weak.length === 0) return null
  const t = weak[0]
  const sid = topicToSubjectId(t.id, topicMap, offeringMap)
  if (!sid) return null
  const s = subjectMap.get(sid)
  if (!s) return null
  return { topicName: t.name, subjectName: s.name, subjectColor: s.color }
}

function outcomeChip(score: number): { label: string; color: string } {
  if (score >= 0.8) return { label: 'Strong', color: 'bg-green-100 text-green-700' }
  if (score >= 0.6) return { label: 'Solid', color: 'bg-blue-100 text-blue-700' }
  return { label: 'Needs work', color: 'bg-amber-100 text-amber-700' }
}

function momentumData(
  sessions: Session[],
  today: Date,
): { delta: number; thisWeek: number; lastWeek: number; prevEmpty: boolean } {
  const todayISO = getLocalDayKey(today)
  const d7 = new Date(today)
  d7.setDate(d7.getDate() - 7)
  const d7ISO = getLocalDayKey(d7)
  const d14 = new Date(today)
  d14.setDate(d14.getDate() - 14)
  const d14ISO = getLocalDayKey(d14)

  const recent = sessions.filter((s) => s.date > d7ISO && s.date <= todayISO)
  const prev = sessions.filter((s) => s.date > d14ISO && s.date <= d7ISO)

  const avgRecent = recent.length > 0
    ? Math.round((recent.reduce((a, s) => a + s.score, 0) / recent.length) * 100)
    : 0
  const avgPrev = prev.length > 0
    ? Math.round((prev.reduce((a, s) => a + s.score, 0) / prev.length) * 100)
    : 0

  return {
    delta: recent.length > 0 ? avgRecent - avgPrev : 0,
    thisWeek: avgRecent,
    lastWeek: avgPrev,
    prevEmpty: prev.length === 0,
  }
}

// -- New helpers --

type StatusChip = { label: string; color: string; priority: number }

function deriveStatusChip(
  group: { topics: Topic[]; papers: Paper[] },
  today: Date,
  allSessions: Session[],
): StatusChip {
  const todayISO = getLocalDayKey(today)
  const exam = earliestExamDate(group.papers, today)
  const days = exam ? daysRemaining(exam, today) : null
  const coverage = coveragePct(group.topics)

  if (days !== null && days <= 30 && coverage < 0.6) {
    return { label: 'At risk soon', color: 'bg-red-100 text-red-700', priority: 0 }
  }

  if (weakestTopics(group.topics, 1, todayISO).length > 0) {
    return { label: 'Needs attention', color: 'bg-amber-100 text-amber-700', priority: 1 }
  }

  const topicIds = new Set(group.topics.map((t) => t.id))
  const d7 = new Date(today)
  d7.setDate(d7.getDate() - 7)
  const d7ISO = getLocalDayKey(d7)
  const d14 = new Date(today)
  d14.setDate(d14.getDate() - 14)
  const d14ISO = getLocalDayKey(d14)

  const recent = allSessions.filter((s) => topicIds.has(s.topicId) && s.date > d7ISO && s.date <= todayISO)
  const prev = allSessions.filter((s) => topicIds.has(s.topicId) && s.date > d14ISO && s.date <= d7ISO)

  if (recent.length > 0 && prev.length > 0) {
    const avgRecent = recent.reduce((a, s) => a + s.score, 0) / recent.length
    const avgPrev = prev.reduce((a, s) => a + s.score, 0) / prev.length
    if (avgRecent > avgPrev) {
      return { label: 'Improving', color: 'bg-green-100 text-green-700', priority: 2 }
    }
  }

  const studied = group.topics.filter((t) => t.lastReviewed !== null).length
  if (studied === 0) {
    return { label: 'Not started', color: 'bg-gray-100 text-gray-600', priority: 3 }
  }

  return { label: 'On track', color: 'bg-blue-100 text-blue-700', priority: 4 }
}

function supportiveCopy(weekSessionCount: number): string {
  if (weekSessionCount >= 3) return "You're building momentum."
  if (weekSessionCount >= 1) return 'A short session today keeps the streak alive.'
  return 'Start with one 15-minute session today.'
}

// -- Sub-components --

const CONFIDENCE_COLORS = ['#ef4444', '#f59e0b', '#84cc16', '#16a34a', '#0d9488'] as const

function ConfidenceDots({ level }: { level: number; color?: string }) {
  const fill = CONFIDENCE_COLORS[Math.max(0, Math.min(4, level - 1))]
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: i <= level ? fill : '#e5e7eb' }}
        />
      ))}
    </div>
  )
}

// Block 1: OverviewHero
function OverviewHero({
  streak,
  weekDuration,
  weekSessionCount,
  nearestExam,
  hasSessions,
  onGoToToday,
}: {
  streak: number
  weekDuration: number
  weekSessionCount: number
  nearestExam: { date: string; days: number } | null
  hasSessions: boolean
  onGoToToday: () => void
}) {
  const showCta = !hasSessions || (streak === 0 && hasSessions)
  const ctaLabel = !hasSessions ? 'Plan today\u2019s study' : 'Keep the streak going'

  return (
    <div data-testid="progress-hero" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-6 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <p className="text-base font-semibold text-gray-900">
          {streak >= 2 ? (
            <>
              <span className="mr-1">{'\uD83D\uDD25'}</span>
              {streak} day streak
            </>
          ) : streak === 1 ? (
            'You studied today'
          ) : (
            'Start a streak today'
          )}
        </p>
        <p className="text-sm text-gray-400">{supportiveCopy(weekSessionCount)}</p>
      </div>

      {hasSessions && (
        <div className="mt-3">
          <p className="text-2xl font-bold text-gray-900">
            {weekDuration > 0 ? formatDuration(weekDuration) : '0m'}
          </p>
          <p className="text-sm text-gray-500">
            across {weekSessionCount} {weekSessionCount === 1 ? 'session' : 'sessions'} this week
          </p>
        </div>
      )}

      {nearestExam && (
        <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-xs text-gray-500">
            Next exam in <span className="font-semibold text-gray-700">{nearestExam.days} {nearestExam.days === 1 ? 'day' : 'days'}</span>
          </p>
        </div>
      )}

      {showCta && (
        <button
          data-testid="progress-hero-cta"
          onClick={onGoToToday}
          className="mt-3 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:scale-[0.98] transition-all"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  )
}

// MetricTile
function MetricTile({ label, value, delta }: { label: string; value: string; delta?: { value: string; positive: boolean } }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-3.5">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {delta && (
        <p className={`text-[10px] ${delta.positive ? 'text-green-600' : 'text-red-500'}`}>
          {delta.value}
        </p>
      )}
    </div>
  )
}

// MomentumChart
function MomentumChart({
  dailyStudyMinutes,
  weekDurationDeltaPct,
}: {
  dailyStudyMinutes: { day: string; minutes: number }[]
  weekDurationDeltaPct: number
}) {
  const maxMinutes = Math.max(...dailyStudyMinutes.map((d) => d.minutes), 1)
  const todayIdx = new Date().getDay()
  // Convert JS day (0=Sun) to our array index (0=Mon)
  const todayBarIdx = todayIdx === 0 ? 6 : todayIdx - 1

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold">This week</p>
        {weekDurationDeltaPct !== 0 && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            weekDurationDeltaPct > 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
          }`}>
            {weekDurationDeltaPct > 0 ? '+' : ''}{weekDurationDeltaPct}% vs last week
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2 h-28">
        {dailyStudyMinutes.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
              {d.minutes > 0 ? (
                <div
                  className={`w-full max-w-[28px] rounded-t-md ${i === todayBarIdx ? 'bg-blue-500' : 'bg-blue-200'}`}
                  style={{ height: `${(d.minutes / maxMinutes) * 100}%`, minHeight: '4px' }}
                />
              ) : (
                <div className="w-full max-w-[28px] bg-gray-200 rounded-t-md" style={{ height: '2px' }} />
              )}
            </div>
            <span className="text-[10px] text-gray-400">{d.day}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// SubjectAllocationCard
function SubjectAllocationCard({
  last7Sessions,
  subjects,
  topicMap,
  offeringMap,
}: {
  last7Sessions: Session[]
  subjects: Subject[]
  topicMap: Map<string, Topic>
  offeringMap: Map<string, Offering>
}) {
  const durBySubject = new Map<string, number>()
  const countBySubject = new Map<string, number>()
  for (const s of last7Sessions) {
    const sid = topicToSubjectId(s.topicId, topicMap, offeringMap)
    if (sid) {
      durBySubject.set(sid, (durBySubject.get(sid) || 0) + (s.durationSeconds ?? 0))
      countBySubject.set(sid, (countBySubject.get(sid) || 0) + 1)
    }
  }

  const totalDur = [...durBySubject.values()].reduce((a, b) => a + b, 0)
  const totalCount = [...countBySubject.values()].reduce((a, b) => a + b, 0)
  const useDuration = totalDur > 0
  const sourceMap = useDuration ? durBySubject : countBySubject
  const total = useDuration ? totalDur : totalCount

  const subjectMapLocal = new Map(subjects.map((s) => [s.id, s]))
  const distEntries = [...sourceMap.entries()]
    .map(([sid, val]) => ({ subject: subjectMapLocal.get(sid)!, value: val }))
    .filter((e) => e.subject)
    .sort((a, b) => b.value - a.value)

  if (distEntries.length < 2) return null

  return (
    <div data-testid="progress-allocation" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-3">Where your time went</p>
      <div data-testid="progress-distribution" className="flex h-3 rounded-full overflow-hidden mb-3">
        {distEntries.map((e) => (
          <div key={e.subject.id} style={{ width: `${(e.value / total) * 100}%`, backgroundColor: e.subject.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {distEntries.map((e) => (
          <div key={e.subject.id} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rotate-45 rounded-[1px]" style={{ backgroundColor: e.subject.color }} />
            <span className="text-xs text-gray-500">
              {e.subject.name} {useDuration ? formatDuration(e.value) : `${e.value} sessions`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Block 3: SubjectRow
function SubjectRow({
  subject,
  offering,
  offeringTopics,
  offeringPapers,
  offeringNotes,
  statusChip,
  expanded,
  onToggle,
  today,
  allSessions,
}: {
  subject: Subject
  offering: Offering
  offeringTopics: Topic[]
  offeringPapers: Paper[]
  offeringNotes: Map<string, Note[]>
  statusChip: StatusChip
  expanded: boolean
  onToggle: () => void
  today: Date
  allSessions: Session[]
}) {
  const [showAllNotes, setShowAllNotes] = useState(false)

  const coverage = coveragePct(offeringTopics)
  const exam = earliestExamDate(offeringPapers, today)
  const days = exam ? daysRemaining(exam, today) : null
  const weak = weakestTopics(offeringTopics, 3, getLocalDayKey(today))
  const gap = confidenceGap(offeringTopics)

  const studied = offeringTopics.filter((t) => t.lastReviewed !== null).length
  const totalTopics = offeringTopics.length

  let countdownColor = 'text-gray-500'
  if (days !== null && days <= 7) countdownColor = 'text-red-500'
  else if (days !== null && days <= 29) countdownColor = 'text-amber-500'

  // Avg score last 7d
  const topicIds = new Set(offeringTopics.map((t) => t.id))
  const todayISO = getLocalDayKey(today)
  const d7 = new Date(today)
  d7.setDate(d7.getDate() - 7)
  const d7ISO = getLocalDayKey(d7)
  const recentSubj = allSessions.filter((s) => topicIds.has(s.topicId) && s.date > d7ISO && s.date <= todayISO)
  const avgScore7d = recentSubj.length > 0 ? Math.round((recentSubj.reduce((a, s) => a + s.score, 0) / recentSubj.length) * 100) : null

  // Notes
  const allOfferingNotes: (Note & { topicName: string })[] = []
  const topicMap = new Map(offeringTopics.map((t) => [t.id, t]))
  for (const [topicId, notesList] of offeringNotes) {
    const topic = topicMap.get(topicId)
    if (!topic) continue
    for (const note of notesList) {
      allOfferingNotes.push({ ...note, topicName: topic.name })
    }
  }
  allOfferingNotes.sort((a, b) => b.date.localeCompare(a.date))
  const visibleNotes = showAllNotes ? allOfferingNotes : allOfferingNotes.slice(0, 3)
  const hasMoreNotes = allOfferingNotes.length > 3

  return (
    <div data-testid="progress-subject-row" className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-stretch text-left transition-shadow hover:shadow-md active:scale-[0.99]"
      >
        <div className="w-1.5 shrink-0" style={{ backgroundColor: subject.color }} />
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-semibold text-gray-900 truncate">{subject.name}</p>
              <p className="text-xs text-gray-400">{offering.label}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {days !== null && (
                  <span className={`text-xs ${countdownColor}`}>
                    Exam in {days} {days === 1 ? 'day' : 'days'}
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {'\u00B7'} {studied} / {totalTopics} topics studied
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span data-testid="progress-status-chip" className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusChip.color}`}>
                {statusChip.label}
              </span>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          <div className="mt-2">
            <div className="h-1.5 rounded-full bg-gray-200">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.round(coverage * 100)}%`, backgroundColor: subject.color }}
              />
            </div>
          </div>
        </div>
      </button>

      {/* Expanded */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 border-t border-gray-100">
            {avgScore7d !== null && (
              <div className="mt-3 mb-3">
                <p className="text-xs text-gray-500">Average result this week: <span className={`font-semibold ${outcomeChip(avgScore7d / 100).color} px-1.5 py-0.5 rounded-full`}>{outcomeChip(avgScore7d / 100).label}</span> <span className="text-gray-400">&middot; {avgScore7d}%</span></p>
              </div>
            )}

            {gap && (
              <div className="mb-3">
                <p className={`text-xs font-medium rounded-lg px-3 py-2 ${
                  gap === 'overconfident'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-blue-50 text-blue-600'
                }`}>
                  {gap === 'overconfident'
                    ? 'Your confidence is ahead of your scores right now.'
                    : "You're doing better than your confidence suggests."}
                </p>
              </div>
            )}

            <div className={studied === 0 ? 'mb-5' : 'mb-4'}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 mb-2">Focus next</p>
              {studied === 0 ? (
                <div data-testid="progress-not-started-msg" className="rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-4">
                  <p className="text-sm leading-5 text-gray-600 mb-3">You haven&apos;t started this subject yet. Start with one of these topics.</p>
                  <div className="space-y-2">
                    {offeringTopics.slice(0, 3).map((t) => (
                      <div key={t.id} className="rounded-lg bg-white border border-gray-100 px-3 py-2.5">
                        <span className="text-sm font-medium text-gray-800">{t.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : weak.length === 0 ? (
                <p className="text-xs text-green-400">Nice work — nothing needs attention right now.</p>
              ) : (
                <>
                  <p className="text-[10px] text-gray-400 mb-1.5">Confidence shown by dots</p>
                  <div className="space-y-1.5">
                    {weak.map((t) => (
                      <div key={t.id} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 truncate flex-1 mr-2">{t.name}</span>
                        <ConfidenceDots level={t.confidence} color={subject.color} />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500 mb-2">Notes</p>
              {allOfferingNotes.length === 0 ? (
                <p className="text-xs text-gray-300">No notes yet</p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    {visibleNotes.map((note) => (
                      <div key={note.id} className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-sm text-gray-700">{note.text}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{note.topicName} &middot; {note.date}</p>
                      </div>
                    ))}
                  </div>
                  {hasMoreNotes && (
                    <button
                      data-testid="progress-show-all-notes"
                      onClick={(e) => { e.stopPropagation(); setShowAllNotes(!showAllNotes) }}
                      className="text-xs text-blue-500 mt-2 hover:underline"
                    >
                      {showAllNotes ? 'Show fewer notes' : 'Show all notes'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Block 4: SessionsList (kept)
function SessionsList({
  sessions,
  topicMap,
  offeringMap,
  subjects,
}: {
  sessions: Session[]
  topicMap: Map<string, Topic>
  offeringMap: Map<string, Offering>
  subjects: Subject[]
}) {
  const todayISO = getLocalDayKey(new Date())
  const todaySessions = sessions
    .filter((s) => s.date === todayISO)
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))

  if (todaySessions.length === 0) return null

  const subjectMapLocal = new Map(subjects.map((s) => [s.id, s]))

  return (
    <div data-testid="progress-sessions-list" className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Sessions</p>
      <div className="space-y-2.5">
        {todaySessions.map((s) => {
          const topic = topicMap.get(s.topicId)
          const sid = topic ? topicToSubjectId(s.topicId, topicMap, offeringMap) : undefined
          const subject = sid ? subjectMapLocal.get(sid) : undefined
          return (
            <div key={s.id} className="flex items-center gap-2.5">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: subject?.color || '#9ca3af' }}
              />
              <span className="text-sm text-gray-800 truncate flex-1">{topic?.name}</span>
              <span className="text-xs text-gray-400 shrink-0">
                {s.durationSeconds !== undefined ? formatDuration(s.durationSeconds) : '\u2014'}
              </span>
              <span data-testid="progress-outcome-chip" className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${outcomeChip(s.score).color}`}>
                {outcomeChip(s.score).label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Block 5: BestNextFocus
function BestNextFocus({
  suggestion,
  hasFutureExamTopics,
}: {
  suggestion: { topicName: string; subjectName: string; subjectColor: string } | null
  hasFutureExamTopics: boolean
}) {
  if (!hasFutureExamTopics) return null

  if (!suggestion) {
    return (
      <div data-testid="progress-best-next-focus" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
        <p className="text-sm text-green-500">Nice work — no weak spots right now.</p>
      </div>
    )
  }

  return (
    <div data-testid="progress-best-next-focus" className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-center">
      <p className="text-sm text-gray-600">
        Next best focus:{' '}
        <span className="font-semibold" style={{ color: suggestion.subjectColor }}>
          {suggestion.subjectName}
        </span>
        {' \u2014 '}
        <span className="font-medium text-gray-800">{suggestion.topicName}</span>
      </p>
    </div>
  )
}

// -- Main --

export default function Progress({ onGoToToday }: { onGoToToday: () => void }) {
  const topics = useAppStore((s) => s.topics)
  const sessions = useAppStore((s) => s.sessions)
  const subjects = useAppStore((s) => s.subjects)
  const papers = useAppStore((s) => s.papers)
  const allOfferings = useAppStore((s) => s.offerings)
  const selectedOfferingIds = useAppStore((s) => s.selectedOfferingIds)
  const notes = useAppStore((s) => s.notes)

  const [expanded, setExpanded] = useState<string | null>(null)

  const today = useMemo(() => new Date(), [])
  const todayISO = getLocalDayKey(today)

  const selOfferingSet = useMemo(() => new Set(selectedOfferingIds), [selectedOfferingIds])
  const selTopics = useMemo(() => topics.filter((t) => selOfferingSet.has(t.offeringId)), [topics, selOfferingSet])
  const selPapers = useMemo(() => papers.filter((p) => selOfferingSet.has(p.offeringId)), [papers, selOfferingSet])

  const topicMapAll = useMemo(() => new Map(topics.map((t) => [t.id, t])), [topics])
  const offeringMapAll = useMemo(() => new Map(allOfferings.map((o) => [o.id, o])), [allOfferings])

  // Filter sessions to selected offerings only
  const selTopicIds = useMemo(() => new Set(selTopics.map((t) => t.id)), [selTopics])
  const filteredSessions = useMemo(() => sessions.filter((s) => selTopicIds.has(s.topicId)), [sessions, selTopicIds])

  const streak = useMemo(() => studyStreak(filteredSessions, today), [filteredSessions, today])
  const last7Sessions = useMemo(() => sessionsInWindow(filteredSessions, today, 7), [filteredSessions, today])
  const weekSessionCount = last7Sessions.length
  const weekDuration = useMemo(() => totalDurationSeconds(last7Sessions), [last7Sessions])
  const momentum = useMemo(() => momentumData(filteredSessions, today), [filteredSessions, today])

  const prev7Sessions = useMemo(() => {
    const d7 = new Date(today)
    d7.setDate(d7.getDate() - 7)
    return sessionsInWindow(filteredSessions, d7, 7)
  }, [filteredSessions, today])
  const prevWeekDuration = useMemo(() => totalDurationSeconds(prev7Sessions), [prev7Sessions])

  const topicsReviewedThisWeek = useMemo(() => {
    const topicIds = new Set<string>()
    for (const s of last7Sessions) topicIds.add(s.topicId)
    return topicIds.size
  }, [last7Sessions])

  // New data: daily study minutes for MomentumChart
  const dailyStudyMinutes = useMemo(() => {
    const result: { day: string; minutes: number }[] = []
    const todayDay = today.getDay()
    const mondayOffset = todayDay === 0 ? 6 : todayDay - 1
    const monday = new Date(today)
    monday.setDate(monday.getDate() - mondayOffset)
    const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      const iso = getLocalDayKey(d)
      const daySeconds = filteredSessions
        .filter((s) => s.date === iso)
        .reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0)
      result.push({ day: dayNames[i], minutes: Math.round(daySeconds / 60) })
    }
    return result
  }, [filteredSessions, today])

  // Nearest exam for hero
  const nearestExam = useMemo(() => {
    const exam = earliestExamDate(selPapers, today)
    if (!exam) return null
    return { date: exam, days: daysRemaining(exam, today) }
  }, [selPapers, today])

  // Subjects active this week
  const subjectsActiveThisWeek = useMemo(() => {
    const sids = new Set<string>()
    for (const s of last7Sessions) {
      const sid = topicToSubjectId(s.topicId, topicMapAll, offeringMapAll)
      if (sid) sids.add(sid)
    }
    return sids.size
  }, [last7Sessions, topicMapAll, offeringMapAll])

  // Week-over-week duration delta percentage
  const weekDurationDeltaPct = prevWeekDuration > 0
    ? Math.round(((weekDuration - prevWeekDuration) / prevWeekDuration) * 100)
    : weekDuration > 0 ? 100 : 0

  // Build offering groups
  const offeringGroups = useMemo(() => {
    const subjectMap = new Map(subjects.map((s) => [s.id, s]))
    const groups = new Map<string, { subject: Subject; offering: Offering; topics: Topic[]; papers: Paper[] }>()

    for (const t of selTopics) {
      const off = offeringMapAll.get(t.offeringId)
      if (!off) continue
      let group = groups.get(off.id)
      if (!group) {
        const sub = subjectMap.get(off.subjectId)
        if (!sub) continue
        group = { subject: sub, offering: off, topics: [], papers: [] }
        groups.set(off.id, group)
      }
      group.topics.push(t)
    }

    for (const p of selPapers) {
      const group = groups.get(p.offeringId)
      if (group) group.papers.push(p)
    }

    return groups
  }, [selTopics, selPapers, subjects, offeringMapAll])

  // Notes grouped by offering -> topic
  const notesByOfferingTopic = useMemo(() => {
    const result = new Map<string, Map<string, Note[]>>()
    for (const note of notes) {
      const topic = topicMapAll.get(note.topicId)
      if (!topic) continue
      if (!result.has(topic.offeringId)) result.set(topic.offeringId, new Map())
      const topicGroup = result.get(topic.offeringId)!
      if (!topicGroup.has(note.topicId)) topicGroup.set(note.topicId, [])
      topicGroup.get(note.topicId)!.push(note)
    }
    return result
  }, [notes, topicMapAll])

  // Active offering groups
  const activeOfferingGroups = useMemo(() => {
    const now = toMidnightUTC(today)
    return [...offeringGroups.values()]
      .filter((g) => g.papers.some((p) => toMidnightUTC(new Date(p.examDate)) > now))
      .map((g) => ({ ...g, statusChip: deriveStatusChip(g, today, filteredSessions) }))
      .sort((a, b) => {
        if (a.statusChip.priority !== b.statusChip.priority) return a.statusChip.priority - b.statusChip.priority
        const aExam = earliestExamDate(a.papers, today) || '9999'
        const bExam = earliestExamDate(b.papers, today) || '9999'
        return aExam.localeCompare(bExam)
      })
  }, [offeringGroups, today, filteredSessions])

  const hasSelectedOfferings = offeringGroups.size > 0
  const allExamsPast = hasSelectedOfferings && activeOfferingGroups.length === 0

  const suggestion = useMemo(
    () => focusSuggestion(selTopics, selPapers, topicMapAll, offeringMapAll, subjects, todayISO, today),
    [selTopics, selPapers, topicMapAll, offeringMapAll, subjects, todayISO, today],
  )

  const hasFutureExamTopics = activeOfferingGroups.length > 0

  const toggle = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id))
  }

  const hasSessions = filteredSessions.length > 0

  // SubjectAllocationCard show guard
  const showDistribution = useMemo(() => {
    const sids = new Set<string>()
    for (const s of last7Sessions) {
      const sid = topicToSubjectId(s.topicId, topicMapAll, offeringMapAll)
      if (sid) sids.add(sid)
    }
    return sids.size >= 2
  }, [last7Sessions, topicMapAll, offeringMapAll])

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Progress</h1>

      {/* Block 1: Hero */}
      <OverviewHero
        streak={streak}
        weekDuration={weekDuration}
        weekSessionCount={weekSessionCount}
        nearestExam={nearestExam}
        hasSessions={hasSessions}
        onGoToToday={onGoToToday}
      />

      {/* KPI Metric Tiles */}
      {hasSessions && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <MetricTile label="Topics reviewed" value={String(topicsReviewedThisWeek)} />
          <MetricTile
            label="Avg score"
            value={momentum.thisWeek > 0 ? `${momentum.thisWeek}%` : '\u2014'}
            delta={momentum.delta !== 0 ? { value: `${momentum.delta > 0 ? '+' : ''}${momentum.delta}%`, positive: momentum.delta > 0 } : undefined}
          />
          <MetricTile label="Subjects active" value={String(subjectsActiveThisWeek)} />
          <MetricTile label="Days to exam" value={nearestExam ? String(nearestExam.days) : '\u2014'} />
        </div>
      )}

      {/* MomentumChart */}
      {hasSessions && (
        <MomentumChart dailyStudyMinutes={dailyStudyMinutes} weekDurationDeltaPct={weekDurationDeltaPct} />
      )}

      {/* SubjectAllocationCard */}
      {hasSessions && showDistribution && (
        <SubjectAllocationCard
          last7Sessions={last7Sessions}
          subjects={subjects}
          topicMap={topicMapAll}
          offeringMap={offeringMapAll}
        />
      )}

      {/* Subjects at a glance */}
      {allExamsPast ? (
        <div data-testid="progress-no-upcoming" className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5 text-center">
          <p className="text-sm text-gray-500">No upcoming exams in your selected subjects.</p>
        </div>
      ) : activeOfferingGroups.length > 0 && (
        <>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-[0.14em] mb-4">Subjects at a glance</h2>
          <div className="flex flex-col gap-3 mb-5">
            {activeOfferingGroups.map((group) => (
              <SubjectRow
                key={group.offering.id}
                subject={group.subject}
                offering={group.offering}
                offeringTopics={group.topics}
                offeringPapers={group.papers}
                offeringNotes={notesByOfferingTopic.get(group.offering.id) || new Map()}
                statusChip={group.statusChip}
                expanded={expanded === group.offering.id}
                onToggle={() => toggle(group.offering.id)}
                today={today}
                allSessions={filteredSessions}
              />
            ))}
          </div>
        </>
      )}

      {/* Sessions (today) */}
      {hasSessions && (
        <SessionsList sessions={filteredSessions} topicMap={topicMapAll} offeringMap={offeringMapAll} subjects={subjects} />
      )}

      {/* Best Next Focus */}
      {hasSessions && (
        <BestNextFocus suggestion={suggestion} hasFutureExamTopics={hasFutureExamTopics} />
      )}

      {/* Empty state */}
      {!hasSessions && (
        <div data-testid="progress-empty-message" className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-6 text-center mt-2">
          <p className="text-sm text-gray-400">Your progress will start to build after your first study session.</p>
        </div>
      )}
    </div>
  )
}
