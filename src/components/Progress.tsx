import { useState, useMemo } from 'react'
import { useAppStore } from '../stores/app.store'
import { daysRemaining, toMidnightUTC } from '../lib/engine'
import { getLocalDayKey } from '../lib/date'
import type { Topic, Paper, Session, Subject, Offering, Note } from '../types'

// -- Helpers --

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

function longestSessionSeconds(sessions: Session[]): number {
  let max = 0
  for (const s of sessions) {
    if (s.durationSeconds !== undefined && s.durationSeconds > max) max = s.durationSeconds
  }
  return Math.min(max, 7200)
}

type DotIntensity = 'none' | 'light' | 'medium' | 'dark'

function weekDotIntensity(sessions: Session[], dayISO: string): DotIntensity {
  const daySessions = sessions.filter((s) => s.date === dayISO)
  if (daySessions.length === 0) return 'none'
  const dur = totalDurationSeconds(daySessions)
  if (dur === 0) return 'light'
  if (dur < 1200) return 'light'
  if (dur < 2700) return 'medium'
  return 'dark'
}

// Derive subjectId from topic via offering lookup
function topicToSubjectId(topicId: string, topicMap: Map<string, Topic>, offeringMap: Map<string, Offering>): string | undefined {
  const topic = topicMap.get(topicId)
  if (!topic) return undefined
  const offering = offeringMap.get(topic.offeringId)
  return offering?.subjectId
}

function mostActiveSubject(
  sessions: Session[],
  topicMap: Map<string, Topic>,
  offeringMap: Map<string, Offering>,
  subjects: Subject[],
  today: Date,
): { name: string; duration: number } | null {
  const last7 = sessionsInWindow(sessions, today, 7)
  if (last7.length === 0) return null

  const durBySubject = new Map<string, number>()
  for (const s of last7) {
    const sid = topicToSubjectId(s.topicId, topicMap, offeringMap)
    if (sid) durBySubject.set(sid, (durBySubject.get(sid) || 0) + (s.durationSeconds ?? 0))
  }

  let bestId: string | null = null
  let bestDur = 0
  for (const [sid, dur] of durBySubject) {
    if (dur > bestDur) { bestId = sid; bestDur = dur }
  }

  if (!bestId || bestDur === 0) return null
  const sub = subjects.find((s) => s.id === bestId)
  if (!sub) return null
  return { name: sub.name, duration: bestDur }
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

function buildSessionCounts(sessions: Session[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const s of sessions) {
    counts.set(s.topicId, (counts.get(s.topicId) || 0) + 1)
  }
  return counts
}

function insightBanner(
  offeringGroups: Map<string, { subject: Subject; offering: Offering; topics: Topic[]; papers: Paper[] }>,
  today: Date,
): string | null {
  let bestName: string | null = null
  let bestDays = Infinity
  let bestUntouched = 0

  for (const [, group] of offeringGroups) {
    const exam = earliestExamDate(group.papers, today)
    if (!exam) continue
    const days = daysRemaining(exam, today)
    if (days > 30) continue

    const coverage = coveragePct(group.topics)
    if (coverage >= 0.6) continue

    const untouched = group.topics.filter((t) => t.lastReviewed === null).length
    if (untouched === 0) continue

    if (days < bestDays) {
      bestDays = days
      bestName = `${group.subject.name} (${group.offering.label})`
      bestUntouched = untouched
    }
  }

  if (!bestName) return null
  return `${bestName} exam in ${bestDays} ${bestDays === 1 ? 'day' : 'days'} — ${bestUntouched} ${bestUntouched === 1 ? 'topic' : 'topics'} untouched.`
}

function focusSuggestion(
  topics: Topic[],
  topicMap: Map<string, Topic>,
  offeringMap: Map<string, Offering>,
  subjects: Subject[],
  todayISO: string,
): { topicName: string; subjectName: string; subjectColor: string } | null {
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))
  const weak = weakestTopics(topics, 1, todayISO)
  if (weak.length === 0) return null
  const t = weak[0]
  const sid = topicToSubjectId(t.id, topicMap, offeringMap)
  if (!sid) return null
  const s = subjectMap.get(sid)
  if (!s) return null
  return { topicName: t.name, subjectName: s.name, subjectColor: s.color }
}

function scoreChipColor(score: number): string {
  if (score >= 0.8) return 'bg-green-100 text-green-700'
  if (score >= 0.6) return 'bg-blue-100 text-blue-700'
  if (score >= 0.4) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function getWeekDots(sessions: Session[], today: Date): { day: string; intensity: DotIntensity }[] {
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const todayDay = today.getDay()
  const mondayOffset = todayDay === 0 ? 6 : todayDay - 1
  const monday = new Date(today)
  monday.setDate(monday.getDate() - mondayOffset)

  return dayNames.map((day, i) => {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    const iso = getLocalDayKey(d)
    return { day, intensity: weekDotIntensity(sessions, iso) }
  })
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

function trainingLoadColor(
  deltaSec: number,
  papers: Paper[],
  today: Date,
): string {
  if (deltaSec >= 0) return 'text-green-600'
  const now = toMidnightUTC(today)
  let nearestDays = Infinity
  for (const p of papers) {
    if (toMidnightUTC(new Date(p.examDate)) > now) {
      const d = daysRemaining(p.examDate, today)
      if (d < nearestDays) nearestDays = d
    }
  }
  if (nearestDays <= 14) return 'text-red-500'
  if (nearestDays <= 30) return 'text-amber-500'
  return 'text-gray-500'
}

// -- Sub-components --

const CONFIDENCE_EMOJI = ['😰', '😕', '😐', '🙂', '😎'] as const

function ConfidenceDots({ level }: { level: number; color: string }) {
  return (
    <span className="text-sm leading-none" title={`Confidence: ${level}/5`}>
      {CONFIDENCE_EMOJI[Math.max(0, Math.min(4, level - 1))] ?? '😐'}
    </span>
  )
}

const intensityColor: Record<DotIntensity, string> = {
  none: 'bg-gray-100',
  light: 'bg-blue-200',
  medium: 'bg-blue-400',
  dark: 'bg-blue-600',
}

function TrainingDistribution({
  sessions,
  subjects,
  topicMap,
  offeringMap,
}: {
  sessions: Session[]
  subjects: Subject[]
  topicMap: Map<string, Topic>
  offeringMap: Map<string, Offering>
}) {
  if (sessions.length === 0) return null

  const durBySubject = new Map<string, number>()
  const countBySubject = new Map<string, number>()
  for (const s of sessions) {
    const sid = topicToSubjectId(s.topicId, topicMap, offeringMap)
    if (sid) {
      durBySubject.set(sid, (durBySubject.get(sid) || 0) + (s.durationSeconds ?? 0))
      countBySubject.set(sid, (countBySubject.get(sid) || 0) + 1)
    }
  }

  const totalDur = [...durBySubject.values()].reduce((a, b) => a + b, 0)
  const totalCount = [...countBySubject.values()].reduce((a, b) => a + b, 0)
  const useDuration = totalDur > 0

  const subjectMapLocal = new Map(subjects.map((s) => [s.id, s]))
  const sourceMap = useDuration ? durBySubject : countBySubject
  const total = useDuration ? totalDur : totalCount

  const entries = [...sourceMap.entries()]
    .map(([sid, val]) => ({ subject: subjectMapLocal.get(sid)!, value: val }))
    .filter((e) => e.subject)
    .sort((a, b) => b.value - a.value)

  if (entries.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Training distribution</p>
        <p className="text-[10px] text-gray-400">Last 7 days</p>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden mb-3">
        {entries.map((e) => (
          <div key={e.subject.id} style={{ width: `${(e.value / total) * 100}%`, backgroundColor: e.subject.color }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {entries.map((e) => (
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5">
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
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${scoreChipColor(s.score)}`}>
                {Math.round(s.score * 100)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PerformanceMetrics({
  sessions,
  today,
  papers,
}: {
  sessions: Session[]
  today: Date
  papers: Paper[]
}) {
  const last7 = sessionsInWindow(sessions, today, 7)
  const prev7 = (() => {
    const d7 = new Date(today)
    d7.setDate(d7.getDate() - 7)
    return sessionsInWindow(sessions, d7, 7)
  })()

  const loadThis = totalDurationSeconds(last7)
  const loadPrev = totalDurationSeconds(prev7)
  const loadDelta = loadThis - loadPrev
  const loadColor = trainingLoadColor(loadDelta, papers, today)

  const mom = momentumData(sessions, today)

  const longest = longestSessionSeconds(sessions)

  if (last7.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Performance metrics</p>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">Training Load</p>
          <p className="text-lg font-bold text-gray-900">{formatDuration(loadThis)}</p>
          {loadDelta !== 0 && (
            <p className={`text-[10px] ${loadColor}`}>
              {loadDelta > 0 ? '+' : ''}{formatDuration(Math.abs(loadDelta))} vs prev
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">Momentum</p>
          {mom.prevEmpty ? (
            <p className="text-sm font-semibold text-gray-500">{'\u2192'} New baseline</p>
          ) : (
            <p className={`text-lg font-bold ${
              mom.delta > 0 ? 'text-green-600' : mom.delta < 0 ? 'text-red-500' : 'text-gray-500'
            }`}>
              {mom.delta > 0 ? '\u2191' : mom.delta < 0 ? '\u2193' : '\u2192'}{' '}
              {mom.delta > 0 ? '+' : ''}{mom.delta}%
            </p>
          )}
        </div>
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">Longest Session</p>
          <p className="text-lg font-bold text-gray-900">
            {longest > 0 ? formatDuration(longest) : '\u2014'}
          </p>
        </div>
      </div>
    </div>
  )
}

function OfferingCard({
  subject,
  offering,
  offeringTopics,
  offeringPapers,
  offeringNotes,
  offeringSessionsLast7,
  sessionCounts,
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
  offeringSessionsLast7: Session[]
  sessionCounts: Map<string, number>
  expanded: boolean
  onToggle: () => void
  today: Date
  allSessions: Session[]
}) {
  const coverage = coveragePct(offeringTopics)
  const exam = earliestExamDate(offeringPapers, today)
  const days = exam ? daysRemaining(exam, today) : null
  const weak = weakestTopics(offeringTopics, 3, getLocalDayKey(today))
  const hasAnySessions = offeringTopics.some((t) => t.lastReviewed !== null)
  const gap = confidenceGap(offeringTopics)

  const weekDur = totalDurationSeconds(offeringSessionsLast7)

  const topicIds = new Set(offeringTopics.map((t) => t.id))
  const todayISO = getLocalDayKey(today)
  const d7 = new Date(today)
  d7.setDate(d7.getDate() - 7)
  const d7ISO = getLocalDayKey(d7)
  const d14 = new Date(today)
  d14.setDate(d14.getDate() - 14)
  const d14ISO = getLocalDayKey(d14)

  const offeringAllSessions = allSessions.filter((s) => topicIds.has(s.topicId))
  const recentSubj = offeringAllSessions.filter((s) => s.date > d7ISO && s.date <= todayISO)
  const prevSubj = offeringAllSessions.filter((s) => s.date > d14ISO && s.date <= d7ISO)
  const avgRecentSubj = recentSubj.length > 0 ? recentSubj.reduce((a, s) => a + s.score, 0) / recentSubj.length : 0
  const avgPrevSubj = prevSubj.length > 0 ? prevSubj.reduce((a, s) => a + s.score, 0) / prevSubj.length : 0
  const isImproving = recentSubj.length > 0 && prevSubj.length > 0 && avgRecentSubj > avgPrevSubj

  const avgScore7d = recentSubj.length > 0 ? Math.round(avgRecentSubj * 100) : null

  const topicMap = new Map(offeringTopics.map((t) => [t.id, t]))

  const studied = offeringTopics.filter((t) => t.lastReviewed !== null).length
  const totalTopics = offeringTopics.length

  const needsFocus = days !== null && days <= 14 && coverage < 0.6

  let countdownColor = 'text-gray-500'
  if (days !== null && days <= 7) countdownColor = 'text-red-500'
  else if (days !== null && days <= 29) countdownColor = 'text-amber-500'

  const sortedTopics = [...offeringTopics].sort((a, b) => {
    const aCount = sessionCounts.get(a.id) || 0
    const bCount = sessionCounts.get(b.id) || 0
    if (aCount > 0 && bCount === 0) return -1
    if (aCount === 0 && bCount > 0) return 1
    if (aCount !== bCount) return bCount - aCount
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
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
                {needsFocus && (
                  <span className="text-xs font-medium text-amber-600">{'\u00B7'} Needs focus</span>
                )}
                {!needsFocus && isImproving && (
                  <span className="text-xs font-medium text-green-600">{'\u00B7'} Improving</span>
                )}
                <span className="text-xs text-gray-400">
                  {'\u00B7'} Training this week: {weekDur > 0 ? formatDuration(weekDur) : '0m'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <ConfidenceDots level={Math.round(avgConfidence(offeringTopics))} color={subject.color} />
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
            <p className="text-[10px] text-gray-400 mt-1">{studied} of {totalTopics} topics studied</p>
          </div>
        </div>
      </button>

      {/* Expanded */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 border-t border-gray-50">

            {avgScore7d !== null && (
              <div className="mt-3 mb-3">
                <p className="text-xs text-gray-500">Avg score (last 7d): <span className="font-semibold text-gray-700">{avgScore7d}%</span></p>
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
                    ? 'Your confidence is higher than your scores suggest — keep practising.'
                    : "You're doing better than you think — trust your progress."}
                </p>
              </div>
            )}

            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Topics</p>
              <div className="space-y-1">
                {sortedTopics.map((t) => {
                  const count = sessionCounts.get(t.id) || 0
                  const isReviewed = count > 0
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center justify-between py-1 ${isReviewed ? '' : 'opacity-20'}`}
                    >
                      <span className="text-sm text-gray-700 truncate flex-1 mr-2">{t.name}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <ConfidenceDots level={t.confidence} color={subject.color} />
                        {isReviewed && (
                          <span className="text-xs text-gray-400 w-6 text-right">{'\u00D7'}{count}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs text-gray-500 mb-2">Focus next</p>
              {!hasAnySessions ? (
                <p className="text-xs text-gray-300">Start studying to see insights here.</p>
              ) : weak.length === 0 ? (
                <p className="text-xs text-green-400">Nice work — nothing needs attention right now.</p>
              ) : (
                <div className="space-y-1.5">
                  {weak.map((t) => (
                    <div key={t.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 truncate flex-1 mr-2">{t.name}</span>
                      <ConfidenceDots level={t.confidence} color={subject.color} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Notes</p>
              {offeringNotes.size === 0 ? (
                <p className="text-xs text-gray-300">No notes yet</p>
              ) : (
                [...offeringNotes.entries()].map(([topicId, notes]) => {
                  const topic = topicMap.get(topicId)
                  if (!topic) return null
                  return (
                    <div key={topicId} className="mb-2">
                      <p className="text-xs font-medium text-gray-500 mb-1">{topic.name}</p>
                      <div className="space-y-1">
                        {notes
                          .slice()
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .map((note) => (
                            <div key={note.id} className="bg-gray-50 rounded-lg px-3 py-2">
                              <p className="text-sm text-gray-700">{note.text}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{note.date}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// -- Main --

export default function Progress() {
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

  const streak = useMemo(() => studyStreak(sessions, today), [sessions, today])
  const sessionCounts = useMemo(() => buildSessionCounts(sessions), [sessions])
  const last7Sessions = useMemo(() => sessionsInWindow(sessions, today, 7), [sessions, today])
  const weekSessionCount = last7Sessions.length
  const weekDuration = useMemo(() => totalDurationSeconds(last7Sessions), [last7Sessions])
  const momentum = useMemo(() => momentumData(sessions, today), [sessions, today])
  const mostActive = useMemo(
    () => mostActiveSubject(sessions, topicMapAll, offeringMapAll, subjects, today),
    [sessions, topicMapAll, offeringMapAll, subjects, today],
  )

  // Build offering groups (grouped by offeringId)
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

  // Per-offering sessions last 7d
  const offeringSessionsLast7 = useMemo(() => {
    const result = new Map<string, Session[]>()
    for (const s of last7Sessions) {
      const topic = topicMapAll.get(s.topicId)
      if (!topic) continue
      if (!result.has(topic.offeringId)) result.set(topic.offeringId, [])
      result.get(topic.offeringId)!.push(s)
    }
    return result
  }, [last7Sessions, topicMapAll])

  // Sort offering groups by earliest exam
  const activeOfferingGroups = useMemo(() => {
    const now = toMidnightUTC(today)
    return [...offeringGroups.values()]
      .filter((g) => g.papers.some((p) => toMidnightUTC(new Date(p.examDate)) > now))
      .sort((a, b) => {
        const aExam = earliestExamDate(a.papers, today) || '9999'
        const bExam = earliestExamDate(b.papers, today) || '9999'
        return aExam.localeCompare(bExam)
      })
  }, [offeringGroups, today])

  const weekDots = useMemo(() => getWeekDots(sessions, today), [sessions, today])

  // Global weakest topics (from selected offerings only)
  const globalWeak = useMemo(() => weakestTopics(selTopics, 5, todayISO), [selTopics, todayISO])
  const topicSubjectMap = useMemo(() => {
    const m = new Map<string, Subject>()
    const subjectMap = new Map(subjects.map((s) => [s.id, s]))
    for (const t of selTopics) {
      const off = offeringMapAll.get(t.offeringId)
      if (!off) continue
      const s = subjectMap.get(off.subjectId)
      if (s) m.set(t.id, s)
    }
    return m
  }, [selTopics, subjects, offeringMapAll])

  const insight = useMemo(
    () => insightBanner(offeringGroups, today),
    [offeringGroups, today],
  )

  const suggestion = useMemo(
    () => focusSuggestion(selTopics, topicMapAll, offeringMapAll, subjects, todayISO),
    [selTopics, topicMapAll, offeringMapAll, subjects, todayISO],
  )

  const toggle = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id))
  }

  const hasSessions = sessions.length > 0

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Progress</h1>

      {insight && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
          <p className="text-sm font-medium text-amber-800">{insight}</p>
        </div>
      )}

      {/* Training Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5">
        <p className="text-base font-semibold text-gray-900">
          {streak >= 2 ? (
            <>
              <span className="mr-1">{'\uD83D\uDD25'}</span>
              {streak} day streak
            </>
          ) : streak === 1 ? (
            <>
              <span className="mr-1">{'\u2705'}</span>
              Studied today
            </>
          ) : (
            'Start a streak today.'
          )}
        </p>
        {hasSessions && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-gray-500">
            <span>
              {weekDuration > 0 ? formatDuration(weekDuration) : `${weekSessionCount} sessions`} this week
              {weekDuration > 0 && ` \u00B7 ${weekSessionCount} ${weekSessionCount === 1 ? 'session' : 'sessions'}`}
            </span>
            {momentum.delta !== 0 && !momentum.prevEmpty && (
              <span className={momentum.delta > 0 ? 'text-green-600' : 'text-red-500'}>
                {momentum.delta > 0 ? '\u2191' : '\u2193'} {momentum.delta > 0 ? '+' : ''}{momentum.delta}% avg score vs last week
              </span>
            )}
            {momentum.prevEmpty && last7Sessions.length > 0 && (
              <span className="text-gray-400">{'\u2192'} New baseline</span>
            )}
            {mostActive && (
              <span>Most active: {mostActive.name} ({formatDuration(mostActive.duration)})</span>
            )}
          </div>
        )}
        <div className="flex justify-between mt-3 pt-3 border-t border-gray-50">
          {weekDots.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className={`w-3.5 h-3.5 rounded-full transition-colors ${intensityColor[d.intensity]}`} />
              <span className="text-[10px] text-gray-400">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sessions (today) */}
      <SessionsList sessions={sessions} topicMap={topicMapAll} offeringMap={offeringMapAll} subjects={subjects} />

      {/* Training Distribution */}
      <TrainingDistribution sessions={last7Sessions} subjects={subjects} topicMap={topicMapAll} offeringMap={offeringMapAll} />

      {/* Performance Metrics */}
      <PerformanceMetrics sessions={sessions} today={today} papers={selPapers} />

      {/* Subject Fitness (per offering) */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Subject fitness</h2>
      <div className="flex flex-col gap-3 mb-8">
        {activeOfferingGroups.map((group) => (
          <OfferingCard
            key={group.offering.id}
            subject={group.subject}
            offering={group.offering}
            offeringTopics={group.topics}
            offeringPapers={group.papers}
            offeringNotes={notesByOfferingTopic.get(group.offering.id) || new Map()}
            offeringSessionsLast7={offeringSessionsLast7.get(group.offering.id) || []}
            sessionCounts={sessionCounts}
            expanded={expanded === group.offering.id}
            onToggle={() => toggle(group.offering.id)}
            today={today}
            allSessions={sessions}
          />
        ))}
      </div>

      {/* Focus next — global */}
      {globalWeak.length > 0 ? (
        <>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Focus next</h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
            {globalWeak.map((t, i) => {
              const subject = topicSubjectMap.get(t.id)
              return (
                <div
                  key={t.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: subject?.color || '#9ca3af' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{t.name}</p>
                    <p className="text-xs text-gray-400">{subject?.name}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : hasSessions ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center mb-6">
          <p className="text-sm text-green-500">Nice work — no weak spots right now.</p>
        </div>
      ) : null}

      {/* Focus suggestion */}
      {suggestion && (
        <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
          <p className="text-sm text-gray-600">
            Next best focus:{' '}
            <span className="font-semibold" style={{ color: suggestion.subjectColor }}>
              {suggestion.subjectName}
            </span>
            {' \u2014 '}
            <span className="font-medium text-gray-800">{suggestion.topicName}</span>
          </p>
        </div>
      )}
    </div>
  )
}
