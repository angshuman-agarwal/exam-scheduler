import { useAppStore } from '../stores/app.store'
import { daysRemaining, daysSince } from '../lib/engine'
import { getLocalDayKey } from '../lib/date'
import type { ScoredTopic, Subject, Paper, ScheduleSource } from '../types'

interface SubjectPickerProps {
  subject: Subject
  paper?: Paper | null
  onBack: () => void
  onStartSession: (scored: ScoredTopic, source: ScheduleSource, scheduleItemId?: string) => void
}

const SUGGESTED_COUNT = 3

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

function SuggestedCard({
  scored,
  inPlan,
  planFull,
  onAdd,
  today,
}: {
  scored: ScoredTopic
  inPlan: boolean
  planFull: boolean
  onAdd: () => void
  today: Date
}) {
  const { topic, paper, subject } = scored
  const days = daysRemaining(paper.examDate, today)

  return (
    <div className="w-full flex items-stretch rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      <div className="w-1.5 shrink-0" style={{ backgroundColor: subject.color }} />
      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-base font-semibold text-gray-900 truncate">{topic.name}</p>
          {inPlan ? (
            <span className="text-xs text-gray-400 shrink-0 mt-1">In Plan</span>
          ) : !planFull ? (
            <button
              onClick={onAdd}
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
  today,
}: {
  scored: ScoredTopic
  inPlan: boolean
  planFull: boolean
  onAdd: () => void
  today: Date
}) {
  const { topic, subject } = scored
  return (
    <div className="flex items-center justify-between py-3 px-1 rounded-lg gap-2">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-900 truncate block">{topic.name}</span>
        <div className="flex items-center gap-2 mt-1">
          <ConfidenceDots level={topic.confidence} color={subject.color} />
          <LastStudiedLabel lastReviewed={topic.lastReviewed} today={today} />
        </div>
      </div>
      {inPlan ? (
        <span className="text-xs text-gray-400 shrink-0">In Plan</span>
      ) : !planFull ? (
        <button
          onClick={onAdd}
          className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full border border-gray-200 text-gray-400 transition-colors hover:bg-blue-50 hover:border-blue-300 hover:text-blue-500"
          aria-label="Add to plan"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

export default function SubjectPicker({ subject, paper, onBack, onStartSession }: SubjectPickerProps) {
  const getTopicsForSubject = useAppStore((s) => s.getTopicsForSubject)
  const dailyPlan = useAppStore((s) => s.dailyPlan)
  const planDay = useAppStore((s) => s.planDay)
  const addToPlan = useAppStore((s) => s.addToPlan)
  const removeFromPlan = useAppStore((s) => s.removeFromPlan)
  const topics = useAppStore((s) => s.topics)
  const papers = useAppStore((s) => s.papers)
  const subjects = useAppStore((s) => s.subjects)

  const today = new Date()
  const todayKey = getLocalDayKey(today)
  const planItems = planDay === todayKey ? dailyPlan : []
  const planTopicIds = new Set(planItems.map((i) => i.topicId))
  const planFull = planItems.length >= 4

  // Resolve plan items for tray display
  const topicMap = new Map(topics.map((t) => [t.id, t]))
  const paperMap = new Map(papers.map((p) => [p.id, p]))
  const subjectMap = new Map(subjects.map((s) => [s.id, s]))

  const resolvedPlan = planItems
    .map((item) => {
      const topic = topicMap.get(item.topicId)
      if (!topic) return null
      const paper = paperMap.get(topic.paperId)
      const sub = subjectMap.get(topic.subjectId)
      if (!paper || !sub) return null
      const scored: ScoredTopic = {
        topic, paper, subject: sub,
        score: 0, blockType: 'deep', weakness: 0, recencyFactor: 0,
      }
      return { item, scored }
    })
    .filter(Boolean) as { item: typeof planItems[number]; scored: ScoredTopic }[]

  const subjectScored = getTopicsForSubject(subject.id, today)
  const allScored = paper ? subjectScored.filter((s) => s.paper.id === paper.id) : subjectScored
  const suggested = allScored.slice(0, SUGGESTED_COUNT)
  const rest = allScored.slice(SUGGESTED_COUNT)

  return (
    <div className="px-4 pt-6 min-h-screen bg-gray-50">
      <button
        onClick={onBack}
        className="text-sm text-gray-500 mb-6 flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Plan Tray — always visible, with Start */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Your Plan
          </h2>
          {planItems.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">
              {planItems.length}
            </span>
          )}
        </div>

        {resolvedPlan.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-3 text-center">
            <p className="text-gray-400 text-sm">No topics added yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
            {resolvedPlan.map(({ item, scored: s }) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => onStartSession(s, item.source, item.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') onStartSession(s, item.source, item.id) }}
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors hover:bg-gray-50"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: s.subject.color }}
                />
                <span className="text-sm text-gray-800 truncate flex-1">{s.topic.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFromPlan(item.id) }}
                  className="shrink-0 p-0.5 text-red-300 hover:text-red-500 transition-colors rounded hover:bg-red-50"
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

      {/* Subject header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }} />
        <h1 className="text-2xl font-bold text-gray-900">
          {subject.name}{paper ? ` — ${paper.name}` : ''}
        </h1>
      </div>

      {allScored.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 text-lg">No topics available</p>
          <p className="text-gray-300 text-sm mt-1">All exams for this subject may have passed</p>
        </div>
      ) : (
        <>
          {/* Suggested */}
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Suggested
          </h2>
          <div className="flex flex-col gap-3 mb-8">
            {suggested.map((scored) => (
              <SuggestedCard
                key={scored.topic.id}
                scored={scored}
                inPlan={planTopicIds.has(scored.topic.id)}
                planFull={planFull}
                onAdd={() => addToPlan(scored.topic.id, 'manual', new Date())}
                today={today}
              />
            ))}
          </div>

          {/* All Topics */}
          {rest.length > 0 && (
            <>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                All Topics
              </h2>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100 px-3 mb-8">
                {rest.map((scored) => (
                  <CompactRow
                    key={scored.topic.id}
                    scored={scored}
                    inPlan={planTopicIds.has(scored.topic.id)}
                    planFull={planFull}
                    onAdd={() => addToPlan(scored.topic.id, 'manual', new Date())}
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
