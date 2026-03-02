import { useState } from 'react'
import { getOverdueTopics } from '../lib/engine'
import type { ScoredTopic } from '../types'

interface NudgeBannerProps {
  scoredTopics: ScoredTopic[]
}

export default function NudgeBanner({ scoredTopics }: NudgeBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const overdue = getOverdueTopics(scoredTopics)
  if (overdue.length === 0) return null

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
      <p className="text-sm font-medium text-amber-800">
        {overdue.length} high-impact topic{overdue.length !== 1 ? 's' : ''} overdue for review
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-400 hover:text-amber-600 ml-3 shrink-0"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
