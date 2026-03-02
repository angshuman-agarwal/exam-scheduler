import { useState, useMemo } from 'react'
import { useAppStore } from '../stores/app.store'
import { daysRemaining, daysSince, scoreAllTopics, getSuggestions } from '../lib/engine'
import { getLocalDayKey } from '../lib/date'
import NudgeBanner from './NudgeBanner'
import ExamCalendar from './ExamCalendar'
import type { ScoredTopic, Subject, Paper, ScheduleSource } from '../types'

interface TodayPlanProps {
  onStartSession: (scored: ScoredTopic, source: ScheduleSource, scheduleItemId?: string) => void
  onBrowseSubject: (subject: Subject, paper?: Paper) => void
}

function ConfidenceDots({ level, color }: { level: number; color: string }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: i <= level ? color : '#e5e7eb' }}
        />
      ))}
    </div>
  )
}

export default function TodayPlan({ onStartSession, onBrowseSubject }: TodayPlanProps) {
  const topics = useAppStore((s) => s.topics)
  const papers = useAppStore((s) => s.papers)
  const subjects = useAppStore((s) => s.subjects)
  const initialized = useAppStore((s) => s.initialized)
  const resetAll = useAppStore((s) => s.resetAll)
  const dailyPlan = useAppStore((s) => s.dailyPlan)
  const planDay = useAppStore((s) => s.planDay)
  const addToPlan = useAppStore((s) => s.addToPlan)
  const removeFromPlan = useAppStore((s) => s.removeFromPlan)
  const autoFillPlan = useAppStore((s) => s.autoFillPlan)

  const [showMoreSuggestions, setShowMoreSuggestions] = useState(false)

  const today = new Date()
  const todayKey = getLocalDayKey(today)

  const scored = useMemo(
    () => scoreAllTopics(topics, papers, subjects, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [topics, papers, subjects, todayKey],
  )

  const scoredMap = useMemo(
    () => new Map(scored.map((s) => [s.topic.id, s])),
    [scored],
  )

  const examDateMap = useMemo(() => {
    const map = new Map<string, { paper: Paper; subject: Subject }[]>()
    const subjectMap = new Map(subjects.map((s) => [s.id, s]))
    for (const paper of papers) {
      const sub = subjectMap.get(paper.subjectId)
      if (!sub) continue
      const key = paper.examDate
      const list = map.get(key) || []
      list.push({ paper, subject: sub })
      map.set(key, list)
    }
    return map
  }, [papers, subjects])

  if (!initialized) {
    return <div className="p-6 text-center text-gray-400">Loading...</div>
  }

  const planItems = planDay === todayKey ? dailyPlan : []
  const planTopicIds = new Set(planItems.map((i) => i.topicId))
  const planFull = planItems.length >= 4

  // Resolve plan items to scored topics
  const resolvedPlan = planItems
    .map((item) => ({ item, scored: scoredMap.get(item.topicId) }))
    .filter((r): r is { item: typeof r.item; scored: ScoredTopic } => r.scored !== undefined)

  const suggestions = getSuggestions(scored, planTopicIds)
  const shouldCollapse = planItems.length >= 2

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Today</h1>

      <div className="flex flex-col sm:flex-row sm:gap-6">
        {/* Mobile-only calendar */}
        <div className="sm:hidden mb-6">
          <ExamCalendar examDateMap={examDateMap} onSelectPaper={(subject, paper) => onBrowseSubject(subject, paper)} />
        </div>

        {/* Main column */}
        <div className="flex-1 min-w-0">
          {/* 1. Nudge Banner */}
          <NudgeBanner scoredTopics={scored} />

          {/* 2. Plan Tray */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Your Plan
              </h2>
              {planItems.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">
                  {planItems.length}
                </span>
              )}
            </div>

            {resolvedPlan.length > 0 && (
              <div className="flex flex-col gap-3">
                {resolvedPlan.map(({ item, scored: s }) => {
                  const days = daysRemaining(s.paper.examDate, today)
                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onStartSession(s, item.source, item.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') onStartSession(s, item.source, item.id) }}
                      className="flex items-stretch rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden cursor-pointer transition-all hover:shadow-md active:scale-[0.99]"
                    >
                      <div className="w-1.5 shrink-0" style={{ backgroundColor: s.subject.color }} />
                      <div className="flex-1 p-4 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-base font-semibold text-gray-900 truncate">{s.topic.name}</p>
                            <p className="text-sm text-gray-500 mt-0.5">{s.subject.name}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeFromPlan(item.id) }}
                            className="shrink-0 p-1 text-red-300 hover:text-red-500 transition-colors rounded-md hover:bg-red-50"
                            aria-label="Remove from plan"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <ConfidenceDots level={s.topic.confidence} color={s.subject.color} />
                          <span className="text-xs text-gray-400">
                            Exam in {days} {days === 1 ? 'day' : 'days'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {!planFull && (
              <button
                onClick={() => autoFillPlan(today)}
                className="mt-3 w-full py-2.5 border border-dashed border-gray-300 text-sm text-gray-500 font-medium rounded-xl transition-colors hover:border-blue-400 hover:text-blue-600"
              >
                Auto-fill plan
              </button>
            )}
          </div>

          {/* 3. Suggestions */}
          {suggestions.length > 0 && (
            <div className="mb-6">
              {shouldCollapse && !showMoreSuggestions ? (
                <button
                  onClick={() => setShowMoreSuggestions(true)}
                  className="w-full py-2.5 text-sm text-gray-500 font-medium rounded-xl border border-gray-200 transition-colors hover:bg-gray-50"
                >
                  See more suggestions
                </button>
              ) : (
                <>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Suggested for You
                  </h2>
                  <div className="flex flex-col gap-3">
                    {suggestions.map((s) => {
                      const days = daysRemaining(s.paper.examDate, today)
                      const inPlan = planTopicIds.has(s.topic.id)
                      const since = s.topic.lastReviewed ? daysSince(s.topic.lastReviewed, today) : null
                      return (
                        <div
                          key={s.topic.id}
                          className="flex items-stretch rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden"
                        >
                          <div className="w-1.5 shrink-0" style={{ backgroundColor: s.subject.color }} />
                          <div className="flex-1 p-4 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-base font-semibold text-gray-900 truncate">{s.topic.name}</p>
                              {inPlan ? (
                                <span className="text-xs text-gray-400 shrink-0 mt-1">In Plan</span>
                              ) : !planFull ? (
                                <button
                                  onClick={() => addToPlan(s.topic.id, 'suggested', new Date())}
                                  className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 transition-colors hover:bg-blue-50 hover:border-blue-300 hover:text-blue-500"
                                  aria-label="Add to plan"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                                  </svg>
                                </button>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <ConfidenceDots level={s.topic.confidence} color={s.subject.color} />
                              <span className="text-xs text-gray-400">
                                Exam in {days} {days === 1 ? 'day' : 'days'}
                              </span>
                              {since !== null ? (
                                <span className="text-xs text-gray-400">
                                  {since === 0 ? 'Studied today' : `${since}d ago`}
                                </span>
                              ) : (
                                <span className="text-xs text-amber-400">Not yet studied</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {shouldCollapse && (
                    <button
                      onClick={() => setShowMoreSuggestions(false)}
                      className="mt-2 w-full py-2 text-xs text-gray-400 transition-colors hover:text-gray-600"
                    >
                      Hide suggestions
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {scored.length === 0 && resolvedPlan.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">Nothing to study today</p>
              <p className="text-gray-300 text-sm mt-1">All exams may have passed</p>
            </div>
          )}

          {/* 4. Reset */}
          <div className="mt-8 mb-4 text-center">
            <button
              onClick={() => {
                if (window.confirm('Reset everything? This will clear all sessions and return to onboarding.')) {
                  resetAll()
                }
              }}
              className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
            >
              Reset all data
            </button>
          </div>
        </div>

        {/* Desktop sidebar calendar */}
        <div className="hidden sm:block sm:w-80 shrink-0">
          <div className="sticky top-6">
            <ExamCalendar examDateMap={examDateMap} onSelectPaper={(subject, paper) => onBrowseSubject(subject, paper)} />
          </div>
        </div>
      </div>
    </div>
  )
}
