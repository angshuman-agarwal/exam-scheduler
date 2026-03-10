import { useMemo } from 'react'
import { useAppStore } from '../stores/app.store'
import { daysRemaining, daysSince } from '../lib/engine'
import { getLocalDayKey } from '../lib/date'
import QualificationChip from './QualificationChip'
import type { ScoredTopic, Subject, Offering, Paper, ScheduleSource } from '../types'

interface SubjectPickerProps {
  offering: Offering
  subject: Subject
  paper?: Paper | null
  onBack: () => void
  onStartSession: (scored: ScoredTopic, source: ScheduleSource, scheduleItemId?: string) => void
}

const SUGGESTED_COUNT = 3

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

function LastStudiedLabel({ lastReviewed, today }: { lastReviewed: string | null; today: Date }) {
  if (!lastReviewed) {
    return <span className="text-xs text-amber-400">Not yet studied</span>
  }
  const since = daysSince(lastReviewed, today)
  return (
    <span className="text-xs text-gray-400">
      {since === 0 ? 'Studied today' : `${since}d ago`}
    </span>
  )
}

function SwapButton({ swapName, onSwap }: { swapName: string; onSwap: () => void }) {
  return (
    <button
      onClick={onSwap}
      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-amber-600 bg-amber-50 border border-amber-200 transition-colors hover:bg-amber-100"
      aria-label={`Swap out ${swapName}`}
    >
      {'\u21C5'} Swap out {swapName.length > 12 ? swapName.slice(0, 12) + '\u2026' : swapName}
    </button>
  )
}

function SuggestedCard({
  scored,
  inPlan,
  planFull,
  onAdd,
  onSwap,
  swapName,
  today,
}: {
  scored: ScoredTopic
  inPlan: boolean
  planFull: boolean
  onAdd: () => void
  onSwap?: () => void
  swapName?: string
  today: Date
}) {
  const { topic, paper, subject } = scored
  const days = daysRemaining(paper.examDate, today)

  return (
    <div className="w-full flex items-stretch rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      <div className="w-1.5 shrink-0" style={{ backgroundColor: subject.color }} />
      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-base font-semibold text-gray-900 truncate">{topic.name}</p>
          {inPlan ? (
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 shrink-0 mt-0.5">In plan</span>
          ) : !planFull ? (
            <button
              onClick={onAdd}
              className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-blue-50 border border-blue-200 text-blue-500 transition-colors hover:bg-blue-100 hover:border-blue-400 hover:text-blue-600"
              aria-label="Add to plan"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
              </svg>
            </button>
          ) : onSwap && swapName ? (
            <SwapButton swapName={swapName} onSwap={onSwap} />
          ) : null}
        </div>
        <div className="flex items-center gap-3 mt-2">
          <ConfidenceDots level={topic.confidence} color={subject.color} />
          <span className="text-xs text-gray-400">
            Exam in {days} {days === 1 ? 'day' : 'days'}
          </span>
          <LastStudiedLabel lastReviewed={topic.lastReviewed} today={today} />
        </div>
      </div>
    </div>
  )
}

function CompactRow({
  scored,
  inPlan,
  planFull,
  onAdd,
  onSwap,
  swapName,
  today,
}: {
  scored: ScoredTopic
  inPlan: boolean
  planFull: boolean
  onAdd: () => void
  onSwap?: () => void
  swapName?: string
  today: Date
}) {
  const { topic, subject } = scored
  return (
    <div className="flex items-center justify-between py-3 px-1 gap-2">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-900 truncate block">{topic.name}</span>
        <div className="flex items-center gap-2 mt-1">
          <ConfidenceDots level={topic.confidence} color={subject.color} />
          <LastStudiedLabel lastReviewed={topic.lastReviewed} today={today} />
        </div>
      </div>
      {inPlan ? (
        <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100 shrink-0">In plan</span>
      ) : !planFull ? (
        <button
          onClick={onAdd}
          className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-blue-50 border border-blue-200 text-blue-500 transition-colors hover:bg-blue-100 hover:border-blue-400 hover:text-blue-600"
          aria-label="Add to plan"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
          </svg>
        </button>
      ) : onSwap && swapName ? (
        <SwapButton swapName={swapName} onSwap={onSwap} />
      ) : null}
    </div>
  )
}

export default function SubjectPicker({ offering, subject, paper, onBack, onStartSession }: SubjectPickerProps) {
  const studyMode = useAppStore((s) => s.studyMode)
  const getTopicsForOffering = useAppStore((s) => s.getTopicsForOffering)
  const dailyPlan = useAppStore((s) => s.dailyPlan)
  const planDay = useAppStore((s) => s.planDay)
  const addToPlan = useAppStore((s) => s.addToPlan)
  const removeFromPlan = useAppStore((s) => s.removeFromPlan)
  const topics = useAppStore((s) => s.topics)
  const papers = useAppStore((s) => s.papers)
  const allOfferings = useAppStore((s) => s.offerings)
  const subjects = useAppStore((s) => s.subjects)

  const today = new Date()
  const todayKey = getLocalDayKey(today)
  const planItems = planDay === todayKey ? dailyPlan : []
  const planTopicIds = new Set(planItems.map((i) => i.topicId))
  const planFull = planItems.length >= 4

  // Resolve plan items for tray display
  const topicMap = new Map(topics.map((t) => [t.id, t]))
  const paperMap = new Map(papers.map((p) => [p.id, p]))
  const offeringMap = new Map(allOfferings.map((o) => [o.id, o]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))

  const resolvedPlan = planItems
    .map((item) => {
      const topic = topicMap.get(item.topicId)
      if (!topic) return null
      const p = paperMap.get(topic.paperId)
      const off = offeringMap.get(topic.offeringId)
      if (!p || !off) return null
      const sub = subjectMap.get(off.subjectId)
      if (!sub) return null
      const scored: ScoredTopic = {
        topic, paper: p, offering: off, subject: sub,
        score: 0, blockType: 'deep', weakness: 0, recencyFactor: 0,
      }
      return { item, scored }
    })
    .filter(Boolean) as { item: typeof planItems[number]; scored: ScoredTopic }[]

  const swapCandidate = useMemo(() => {
    if (resolvedPlan.length === 0) return null
    return [...resolvedPlan].sort((a, b) => {
      if (a.item.source === 'auto' && b.item.source !== 'auto') return -1
      if (a.item.source !== 'auto' && b.item.source === 'auto') return 1
      return a.scored.score - b.scored.score
    })[0]
  }, [resolvedPlan])

  const handleSwap = (topicId: string) => {
    if (!swapCandidate) return
    removeFromPlan(swapCandidate.item.id)
    setTimeout(() => addToPlan(topicId, 'manual', new Date()), 0)
  }

  const offeringScored = getTopicsForOffering(offering.id, today)
  const allScored = paper ? offeringScored.filter((s) => s.paper.id === paper.id) : offeringScored
  const suggested = allScored.slice(0, SUGGESTED_COUNT)
  const rest = allScored.slice(SUGGESTED_COUNT)

  return (
    <div className="px-4 pt-6 pb-8 min-h-screen bg-[#faf9f7]">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 mb-6 -ml-1 py-1 px-1.5 rounded-lg transition-colors hover:bg-white hover:text-gray-700"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Subject header */}
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-1.5 h-6 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {subject.name}{paper ? ` \u2014 ${paper.name}` : ''}
        </h1>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-gray-400 ml-4 mb-8">
        {studyMode && <QualificationChip mode={studyMode} />}
        {studyMode && <span>&middot;</span>}
        <span>{offering.label}</span>
      </div>

      {/* Plan Tray */}
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
            Your plan
          </p>
          {planItems.length > 0 && (
            <span className="text-[11px] font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
              {planItems.length}
            </span>
          )}
        </div>

        {resolvedPlan.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4 text-center">
            <p className="text-gray-400 text-sm">No topics added yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
            {resolvedPlan.map(({ item, scored: s }) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => onStartSession(s, item.source, item.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') onStartSession(s, item.source, item.id) }}
                className="flex items-center gap-2.5 px-4 py-3 cursor-pointer transition-colors hover:bg-gray-50/50"
              >
                <div
                  className="w-1.5 h-5 rounded-full shrink-0"
                  style={{ backgroundColor: s.subject.color }}
                />
                <span className="text-sm text-gray-800 truncate flex-1">{s.topic.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFromPlan(item.id) }}
                  className="shrink-0 p-1 text-red-300 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                  aria-label="Remove from plan"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {allScored.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No topics available</p>
          <p className="text-gray-300 text-sm mt-1">All exams for this subject may have passed</p>
        </div>
      ) : (
        <>
          {/* Suggested */}
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">
            Suggested
          </p>
          <div className="flex flex-col gap-3 mb-8">
            {suggested.map((scored) => (
              <SuggestedCard
                key={scored.topic.id}
                scored={scored}
                inPlan={planTopicIds.has(scored.topic.id)}
                planFull={planFull}
                onAdd={() => addToPlan(scored.topic.id, 'manual', new Date())}
                onSwap={swapCandidate ? () => handleSwap(scored.topic.id) : undefined}
                swapName={swapCandidate?.scored.topic.name}
                today={today}
              />
            ))}
          </div>

          {/* Divider */}
          {rest.length > 0 && (
            <>
              <div className="border-t border-gray-100 mb-6" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">
                All topics
              </p>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100 px-3 mb-8">
                {rest.map((scored) => (
                  <CompactRow
                    key={scored.topic.id}
                    scored={scored}
                    inPlan={planTopicIds.has(scored.topic.id)}
                    planFull={planFull}
                    onAdd={() => addToPlan(scored.topic.id, 'manual', new Date())}
                    onSwap={swapCandidate ? () => handleSwap(scored.topic.id) : undefined}
                    swapName={swapCandidate?.scored.topic.name}
                    today={today}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
