import { useState, useMemo } from 'react'
import { useAppStore } from '../stores/app.store'
import { daysRemaining, scoreAllTopics } from '../lib/engine'
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

  const [expanded, setExpanded] = useState<string | null>(null)

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

  const subjectGroups = useMemo(() => {
    const subjectMap = new Map(subjects.map((s) => [s.id, s]))
    const groups = new Map<string, { subject: Subject; topics: ScoredTopic[]; nearestExamDays: number }>()
    for (const s of scored) {
      const sub = subjectMap.get(s.subject.id)
      if (!sub) continue
      let group = groups.get(sub.id)
      if (!group) {
        const days = daysRemaining(s.paper.examDate, today)
        group = { subject: sub, topics: [], nearestExamDays: days }
        groups.set(sub.id, group)
      } else {
        const days = daysRemaining(s.paper.examDate, today)
        if (days < group.nearestExamDays) group.nearestExamDays = days
      }
      group.topics.push(s)
    }
    return Array.from(groups.values()).sort((a, b) => a.nearestExamDays - b.nearestExamDays)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scored, subjects, todayKey])

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

          {/* 3. Browse Topics */}
          {subjectGroups.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Browse Topics
              </h2>
              <div className="flex flex-col gap-3">
                {subjectGroups.map(({ subject, topics: subjectTopics, nearestExamDays }) => {
                  const isExpanded = expanded === subject.id
                  const urgencyColor = nearestExamDays <= 3 ? 'text-red-500' : nearestExamDays <= 7 ? 'text-amber-500' : 'text-gray-400'
                  return (
                    <div
                      key={subject.id}
                      className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden"
                    >
                      <button
                        onClick={() => setExpanded(isExpanded ? null : subject.id)}
                        className="w-full flex items-stretch text-left transition-shadow hover:shadow-md active:scale-[0.99]"
                      >
                        <div className="w-1.5 shrink-0" style={{ backgroundColor: subject.color }} />
                        <div className="flex-1 p-4 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-gray-900 truncate">{subject.name}</p>
                              <p className={`text-xs mt-0.5 ${urgencyColor}`}>
                                Exam in {nearestExamDays} {nearestExamDays === 1 ? 'day' : 'days'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs bg-gray-100 text-gray-500 font-medium px-2 py-0.5 rounded-full">
                                {subjectTopics.length}
                              </span>
                              <svg
                                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                      </button>
                      <div
                        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                      >
                        <div className="overflow-hidden">
                          <div className="px-4 pb-3 border-t border-gray-50">
                            {subjectTopics.map((s) => {
                              const inPlan = planTopicIds.has(s.topic.id)
                              return (
                                <div
                                  key={s.topic.id}
                                  className="flex items-center justify-between gap-2 py-2.5 border-b border-gray-50 last:border-b-0"
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <p className="text-sm text-gray-800 truncate">{s.topic.name}</p>
                                    <ConfidenceDots level={s.topic.confidence} color={subject.color} />
                                  </div>
                                  {inPlan ? (
                                    <span className="text-xs text-gray-400 shrink-0">In Plan</span>
                                  ) : !planFull ? (
                                    <button
                                      onClick={() => addToPlan(s.topic.id, 'suggested', new Date())}
                                      className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 transition-colors hover:bg-blue-50 hover:border-blue-300 hover:text-blue-500"
                                      aria-label={`Add ${s.topic.name} to plan`}
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                                      </svg>
                                    </button>
                                  ) : null}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
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
