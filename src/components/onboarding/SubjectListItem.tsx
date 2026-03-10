import type { Subject } from '../../types'

interface SubjectListItemProps {
  subject: Subject
  isSelected: boolean
  summaryLabel: string | null
  onTap: () => void
  isCustom?: boolean
}

export default function SubjectListItem({ subject, isSelected, summaryLabel, onTap, isCustom }: SubjectListItemProps) {
  return (
    <button
      onClick={onTap}
      className="w-full flex items-center gap-3 px-4 py-3.5 text-left rounded-xl border border-gray-100 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors"
    >
      {/* Color bar */}
      <div
        className="w-1 h-8 rounded-full shrink-0"
        style={{ backgroundColor: isSelected ? subject.color : '#e5e7eb' }}
      />

      {/* Name + label */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-semibold truncate ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>
            {subject.name}
          </span>
          {isCustom && (
            <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold rounded px-1.5 py-0.5 shrink-0">Custom</span>
          )}
        </div>
        {isSelected && summaryLabel && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{summaryLabel}</p>
        )}
      </div>

      {/* Check icon */}
      {isSelected && (
        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: subject.color }}>
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Chevron */}
      <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
