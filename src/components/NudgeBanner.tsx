import { useState } from 'react'
import { getOverdueTopics, sortScoredTopics } from '../lib/engine'
import type { ScoredTopic } from '../types'
import type { PlanningMode } from '../lib/engine'

interface NudgeBannerProps {
  scoredTopics: ScoredTopic[]
  mode: PlanningMode
  nearestExamDays: number
  enabled: boolean
}

export default function NudgeBanner({ scoredTopics, mode, nearestExamDays, enabled }: NudgeBannerProps) {
  // Track what was dismissed and the state snapshot at dismissal time.
  // Dismissal expires when the snapshot no longer matches current props.
  const [crunchDismissedAt, setCrunchDismissedAt] = useState<number | null>(null)
  // Encode both overdue count and nearestExamDays into a single snapshot string
  // so dismissal resets when either the day changes or overdue set changes
  const [overdueDismissedKey, setOverdueDismissedKey] = useState<string | null>(null)

  // Reset dismissals when mode transitions (derive-during-render)
  const [prevMode, setPrevMode] = useState<PlanningMode>(mode)
  if (mode !== prevMode) {
    setPrevMode(mode)
    if (mode === 'crunch') setCrunchDismissedAt(null)
    else setOverdueDismissedKey(null)
  }

  const overdue = sortScoredTopics(getOverdueTopics(scoredTopics))
  const overdueKey = `${nearestExamDays}:${overdue.map((t) => t.topic.id).sort().join(',')}`

  const crunchDismissed = crunchDismissedAt !== null && crunchDismissedAt === nearestExamDays
  const overdueDismissed = overdueDismissedKey !== null && overdueDismissedKey === overdueKey

  if (!enabled) return null

  // Priority 1: crunch mode banner
  if (mode === 'crunch' && !crunchDismissed) {
    return (
      <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl px-4 py-3.5 mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="mt-0.5 text-amber-500 shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">Exams are getting close</p>
              <p className="text-xs text-amber-700/80 mt-0.5">
                Your plan is now prioritising urgent exam coverage and untouched topics.
              </p>
              {nearestExamDays > 0 && nearestExamDays <= 7 && (
                <p className="text-xs text-amber-600 font-medium mt-1">
                  Nearest exam in {nearestExamDays} {nearestExamDays === 1 ? 'day' : 'days'}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setCrunchDismissedAt(nearestExamDays)}
            className="text-amber-400 hover:text-amber-600 shrink-0 mt-0.5"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // Priority 2: overdue review topics — show top overdue topic with detail
  if (overdueDismissed || overdue.length === 0) return null

  const topOverdue = overdue[0]
  const remaining = overdue.length - 1

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="mt-0.5 text-amber-500 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900">Overdue for review</p>
            <p className="text-xs text-amber-700/80 mt-0.5">
              {topOverdue.topic.name} in {topOverdue.subject.name} hasn&apos;t been reviewed in a while.
            </p>
            {remaining > 0 && (
              <p className="text-xs text-amber-600/70 mt-0.5">
                + {remaining} more overdue topic{remaining !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setOverdueDismissedKey(overdueKey)}
          className="text-amber-400 hover:text-amber-600 shrink-0 mt-0.5"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
