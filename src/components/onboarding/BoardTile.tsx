import type { Offering } from '../../types'

export default function BoardTile({
  offering,
  boardName,
  paperCount,
  firstExamLabel,
  selected,
  subjectColor,
  onSelect,
}: {
  offering: Offering
  boardName: string
  paperCount: number
  firstExamLabel: string | null
  selected: boolean
  subjectColor: string
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex-1 min-w-[120px] rounded-xl border-2 p-4 text-left transition-all duration-150 ${
        selected
          ? 'shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 active:scale-[0.98]'
      }`}
      style={selected ? {
        borderColor: subjectColor,
        backgroundColor: '#fff',
      } : undefined}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-base font-semibold text-gray-900">{boardName}</span>
        {selected && (
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: subjectColor }}>
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-2">{offering.spec}</p>
      <div className="flex flex-col gap-0.5">
        {firstExamLabel && (
          <p className="text-xs text-gray-400">First exam: {firstExamLabel}</p>
        )}
        <p className="text-xs text-gray-400">{paperCount} {paperCount === 1 ? 'paper' : 'papers'}</p>
      </div>
    </button>
  )
}
