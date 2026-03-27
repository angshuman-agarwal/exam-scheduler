import { useState, useMemo } from 'react'
import { useAppStore } from '../stores/app.store'
import { daysRemaining, scoreAllTopics, autoFillPlanItems, getPlanningMode, nearestExamDays as calcNearestExamDays } from '../lib/engine'
import { getLocalDayKey } from '../lib/date'
import { useLocalPlansApi } from '../lib/api/local/usePlansApi'
import NudgeBanner from './NudgeBanner'
import ExamCalendar from './ExamCalendar'
import QualificationChip from './QualificationChip'
import type { ScoredTopic, Subject, Offering, Paper, ScheduleSource } from '../types'

interface TodayPlanProps {
  onStartSession: (scored: ScoredTopic, source: ScheduleSource, scheduleItemId?: string) => void
  onBrowseOffering: (offering: Offering, subject: Subject, paper?: Paper) => void
  onEditSubjects: () => void
}

const CONFIDENCE_COLORS = ['#ef4444', '#f59e0b', '#84cc16', '#16a34a', '#0d9488'] as const

function ConfidenceDots({ level }: { level: number; color: string }) {
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

export default function TodayPlan({ onStartSession, onBrowseOffering, onEditSubjects }: TodayPlanProps) {
  const topics = useAppStore((s) => s.topics)
  const papers = useAppStore((s) => s.papers)
  const subjects = useAppStore((s) => s.subjects)
  const allOfferings = useAppStore((s) => s.offerings)
  const selectedOfferingIds = useAppStore((s) => s.selectedOfferingIds)
  const initialized = useAppStore((s) => s.initialized)
  const resetAll = useAppStore((s) => s.resetAll)

  const studyMode = useAppStore((s) => s.studyMode)
  const plansApi = useLocalPlansApi()
  const [expanded, setExpanded] = useState<string | null>(null)

  const today = new Date()
  const todayKey = getLocalDayKey(today)

  // Filter to selected offerings
  const selOfferingSet = useMemo(() => new Set(selectedOfferingIds), [selectedOfferingIds])
  const selTopics = useMemo(() => topics.filter((t) => selOfferingSet.has(t.offeringId)), [topics, selOfferingSet])
  const selPapers = useMemo(() => papers.filter((p) => selOfferingSet.has(p.offeringId)), [papers, selOfferingSet])
  const selOfferings = useMemo(() => allOfferings.filter((o) => selOfferingSet.has(o.id)), [allOfferings, selOfferingSet])

  const planningMode = useMemo(
    () => getPlanningMode(today, selPapers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selPapers, todayKey],
  )
  const nearestDays = useMemo(
    () => calcNearestExamDays(today, selPapers),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selPapers, todayKey],
  )

  const scored = useMemo(
    () => scoreAllTopics(selTopics, selPapers, selOfferings, subjects, today, planningMode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selTopics, selPapers, selOfferings, subjects, todayKey, planningMode],
  )

  const scoredMap = useMemo(
    () => new Map(scored.map((s) => [s.topic.id, s])),
    [scored],
  )

  const offeringMap = useMemo(() => new Map(allOfferings.map((o) => [o.id, o])), [allOfferings])
  const subjectMap = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])

  const examDateMap = useMemo(() => {
    const map = new Map<string, { paper: Paper; subject: Subject; offering: Offering }[]>()
    for (const paper of selPapers) {
      const off = offeringMap.get(paper.offeringId)
      if (!off) continue
      const sub = subjectMap.get(off.subjectId)
      if (!sub) continue
      const key = paper.examDate
      const list = map.get(key) || []
      list.push({ paper, subject: sub, offering: off })
      map.set(key, list)
    }
    return map
  }, [selPapers, offeringMap, subjectMap])

  // Group scored topics by subject for browse section
  const subjectGroups = useMemo(() => {
    const groups = new Map<string, { subject: Subject; offering: Offering; topics: ScoredTopic[]; nearestExamDays: number }>()
    for (const s of scored) {
      const sub = s.subject
      let group = groups.get(sub.id)
      if (!group) {
        const days = daysRemaining(s.paper.examDate, today)
        group = { subject: sub, offering: s.offering, topics: [], nearestExamDays: days }
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

  const planItems = plansApi.getPlanItems(today)
  const planTopicIds = new Set(planItems.map((i) => i.topicId))
  const planFull = planItems.length >= 4
  const hasUserItems = planItems.some((i) => i.source !== 'auto')
  const planLabel = planItems.length === 0 || !hasUserItems ? 'Suggested plan' : 'Your plan'

  // Resolve plan items to scored topics
  const resolvedPlan = planItems
    .map((item) => ({ item, scored: scoredMap.get(item.topicId) }))
    .filter((r): r is { item: typeof r.item; scored: ScoredTopic } => r.scored !== undefined)

  const swapCandidate = useMemo(() => {
    if (resolvedPlan.length === 0) return null
    return [...resolvedPlan].sort((a, b) => {
      if (a.item.source === 'auto' && b.item.source !== 'auto') return -1
      if (a.item.source !== 'auto' && b.item.source === 'auto') return 1
      return a.scored.score - b.scored.score
    })[0]
  }, [resolvedPlan])

  const canAutoFill = useMemo(() => {
    if (planFull) return false
    return autoFillPlanItems(scored, planItems, todayKey, Date.now(), today, planningMode).length > 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scored, planItems, todayKey, planFull, planningMode])

  if (!initialized) {
    return <div className="p-6 text-center text-gray-400">Loading...</div>
  }

  return (
    <div className="px-4 pt-6 pb-8 min-h-screen bg-system-gray">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Study Planner</h1>
            {studyMode && <QualificationChip mode={studyMode} />}
          </div>
          {planningMode === 'crunch' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-700 border border-amber-200/60">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Crunch mode
            </span>
          )}
        </div>
        <button
          onClick={onEditSubjects}
          className="flex items-center gap-1.5 text-xs text-gray-400 font-medium transition-colors hover:text-system-blue"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
          Edit subjects
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:gap-6">
        {/* Mobile-only calendar */}
        <div className="sm:hidden mb-6">
          <ExamCalendar examDateMap={examDateMap} onSelectPaper={(offering, subject, paper) => onBrowseOffering(offering, subject, paper)} />
        </div>

        {/* Main column */}
        <div className="flex-1 min-w-0">
          {/* 1. Nudge Banner — only after plan exists */}
          <NudgeBanner scoredTopics={scored} mode={planningMode} nearestExamDays={nearestDays} enabled={planItems.length > 0} />

          {/* 2. Plan Tray */}
          <div className="mb-6 ios-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                  {planLabel}
                </p>
                {planItems.length > 0 && (
                  <span className="text-[11px] font-semibold bg-gray-100 text-system-blue px-2 py-0.5 rounded-full">
                    {planItems.length}
                  </span>
                )}
              </div>
              {hasUserItems && (
                <button
                  onClick={() => { plansApi.clearPlan(); plansApi.autoFillPlan(today) }}
                  className="flex items-center gap-1 text-[11px] text-gray-400 font-medium transition-colors hover:text-system-blue"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  Use suggested plan
                </button>
              )}
            </div>

            {/* Plan items */}
            {resolvedPlan.length > 0 && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {resolvedPlan.map(({ item, scored: s }) => {
                  const days = daysRemaining(s.paper.examDate, today)
                  return (
                    <div
                      key={item.id}
                      data-testid="today-plan-item"
                      role="button"
                      tabIndex={0}
                      onClick={() => onStartSession(s, item.source, item.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') onStartSession(s, item.source, item.id) }}
                      className="flex items-center gap-3 px-5 py-3.5 cursor-pointer transition-colors hover:bg-gray-50/50"
                    >
                      <div
                        className="w-1.5 h-5 rounded-full shrink-0"
                        style={{ backgroundColor: s.subject.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.topic.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {s.subject.name}
                          <span className="text-gray-300 mx-1">{'\u00B7'}</span>
                          {s.offering.label}
                          <span className="text-gray-300 mx-1">{'\u00B7'}</span>
                          <span className={days <= 3 ? 'text-red-500' : days <= 7 ? 'text-amber-500' : planningMode === 'crunch' && days <= 21 ? 'text-amber-400' : ''}>
                            Exam in {days} {days === 1 ? 'day' : 'days'}
                          </span>
                        </p>
                      </div>
                      <button
                        data-testid="today-plan-remove"
                        onClick={(e) => { e.stopPropagation(); plansApi.removeFromPlan(item.id) }}
                        className="shrink-0 p-1 text-red-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                        aria-label="Remove from plan"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Footer CTA */}
            {!planFull && (
              <div className="border-t border-gray-100 px-5 py-4">
                {canAutoFill ? (
                  resolvedPlan.length === 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => plansApi.autoFillPlan(today)}
                        className="w-full py-2.5 ios-button text-sm"
                      >
                        Create suggested plan
                      </button>
                      <p className="text-xs text-gray-400 text-center mt-1.5">Start with a balanced set of topics.</p>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => plansApi.autoFillPlan(today)}
                        className="w-full py-2.5 border border-dashed border-gray-300 text-sm text-system-blue font-medium rounded-xl transition-colors hover:border-black/20 hover:bg-black/5"
                      >
                        Complete plan
                      </button>
                      <p className="text-xs text-gray-400 text-center mt-1.5">We'll add the best remaining topics for you.</p>
                    </>
                  )
                ) : resolvedPlan.length > 0 ? (
                  <p className="text-xs text-gray-400 text-center">Your plan already includes the best available topics. Add a topic manually below.</p>
                ) : null}
              </div>
            )}
          </div>

          {/* 3. Browse Topics */}
          {subjectGroups.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                  Add topics to plan
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  {CONFIDENCE_COLORS.map((c, i) => (
                    <span key={i} className="flex items-center gap-0.5">
                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: c }} />
                      {['Struggling', 'Shaky', 'OK', 'Good', 'Nailed it'][i]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {subjectGroups.map(({ subject, offering, topics: subjectTopics, nearestExamDays }) => {
                  const isExpanded = expanded === subject.id
                  const urgencyColor = nearestExamDays <= 3 ? 'text-red-500'
                    : nearestExamDays <= 7 ? 'text-amber-500'
                    : planningMode === 'crunch' && nearestExamDays <= 21 ? 'text-amber-400'
                    : 'text-gray-400'
                  return (
                    <div
                      key={subject.id}
                      className="ios-card overflow-hidden"
                    >
                      <button
                        onClick={() => setExpanded(isExpanded ? null : subject.id)}
                        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50/50"
                      >
                        <div className="w-1.5 h-5 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-semibold text-gray-900 truncate">{subject.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {offering.label}
                            <span className="text-gray-300 mx-1">{'\u00B7'}</span>
                            <span className={urgencyColor}>
                              Exam in {nearestExamDays} {nearestExamDays === 1 ? 'day' : 'days'}
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-semibold bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full border border-gray-100">
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
                      </button>
                      <div
                        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
                      >
                        <div className="overflow-hidden">
                          <div className="px-5 pb-3 border-t border-gray-100">
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
                                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 shrink-0">In plan</span>
                                  ) : !planFull ? (
                                    <button
                                      onClick={() => plansApi.addToPlan(s.topic.id, 'suggested', new Date())}
                                      className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-blue-50 border border-blue-200 text-blue-500 transition-colors hover:bg-blue-100 hover:border-blue-400 hover:text-blue-600"
                                      aria-label={`Add ${s.topic.name} to plan`}
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
                                      </svg>
                                    </button>
                                  ) : swapCandidate ? (
                                    <button
                                      onClick={() => {
                                        plansApi.removeFromPlan(swapCandidate.item.id)
                                        setTimeout(() => plansApi.addToPlan(s.topic.id, 'suggested', new Date()), 0)
                                      }}
                                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-amber-600 bg-amber-50 border border-amber-200 transition-colors hover:bg-amber-100"
                                      aria-label={`Swap ${swapCandidate.scored.topic.name} for ${s.topic.name}`}
                                    >
                                      {'\u21C5'} Swap out {swapCandidate.scored.topic.name.length > 12
                                        ? swapCandidate.scored.topic.name.slice(0, 12) + '\u2026'
                                        : swapCandidate.scored.topic.name}
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
            <ExamCalendar examDateMap={examDateMap} onSelectPaper={(offering, subject, paper) => onBrowseOffering(offering, subject, paper)} />
          </div>
        </div>
      </div>
    </div>
  )
}
