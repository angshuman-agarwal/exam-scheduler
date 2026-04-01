import type { Paper } from '../types'

interface FullPaperPracticeCardProps {
  paper: Paper | null
  onStart: () => void
  disabled?: boolean
  description?: string
}

export default function FullPaperPracticeCard({
  paper,
  onStart,
  disabled = false,
  description,
}: FullPaperPracticeCardProps) {
  const resolvedDescription = description ?? (paper
    ? `Start a timed attempt for ${paper.name} and review the score afterwards.`
    : 'Choose a paper to start a timed attempt and review the score afterwards.')

  return (
    <div className="mb-4 rounded-2xl border border-amber-100 bg-white px-4 py-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Full paper practice</p>
          <p className="mt-1 text-xs text-gray-500">{resolvedDescription}</p>
        </div>
        <button
          onClick={onStart}
          disabled={disabled}
          className={[
            'rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-150',
            disabled
              ? 'cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400 shadow-none'
              : 'bg-[linear-gradient(180deg,#2f7cff,#1f63d8)] text-white shadow-[0_10px_20px_rgba(37,95,216,0.22)] hover:translate-y-[-1px]',
          ].join(' ')}
        >
          Start full paper
        </button>
      </div>
    </div>
  )
}
