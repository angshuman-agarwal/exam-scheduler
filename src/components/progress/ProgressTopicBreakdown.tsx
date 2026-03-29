import { type ProgressTableFilter, type TopicTableRow } from './analytics'
import { confidenceEmojis, statusTone } from './shared'

export function ProgressTopicBreakdown({
  rows,
  filter,
  onFilterChange,
  recentlyReviewedLabel = 'Recently Reviewed',
  priorityDisabled = false,
}: {
  rows: TopicTableRow[]
  filter: ProgressTableFilter
  onFilterChange: (next: ProgressTableFilter) => void
  recentlyReviewedLabel?: string
  priorityDisabled?: boolean
}) {
  return (
    <section className="rounded-[1.4rem] border border-black/[0.055] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.055)]">
      <div className="flex flex-col gap-3.5 border-b border-black/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Breakdown</p>
          <h2 className="mt-1 text-[1.15rem] font-bold tracking-[-0.035em] text-gray-900">Topic Mastery</h2>
        </div>
        <div className="flex items-center gap-0 rounded-full bg-black/[0.06] p-[3px]">
          <button
            type="button"
            data-testid="progress-filter-recently-reviewed"
            onClick={() => onFilterChange('recently-reviewed')}
            className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all ${
              filter === 'recently-reviewed'
                ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
                : 'text-gray-500'
            }`}
          >
            {recentlyReviewedLabel}
          </button>
          <button
            type="button"
            data-testid="progress-filter-priority-now"
            onClick={() => onFilterChange('priority-now')}
            disabled={priorityDisabled}
            className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all ${
              filter === 'priority-now'
                ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
                : 'text-gray-500'
            } ${priorityDisabled ? 'cursor-not-allowed opacity-45' : ''}`}
          >
            Priority Now
          </button>
        </div>
      </div>

      <div className="max-h-[32rem] overflow-auto">
        <table data-testid="progress-topic-table" className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-black/[0.06] text-left">
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Subject & Topic</th>
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Confidence</th>
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Recency</th>
              <th className="px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.topic.id} data-testid="progress-topic-row" className="border-t border-black/[0.06] align-top hover:bg-black/[0.01] transition-colors">
                <td className="px-5 py-4">
                  <p className="text-[13px] font-semibold tracking-[-0.02em] text-gray-900">{row.subject.name}</p>
                  <p className="mt-0.5 text-[13px] text-gray-500">{row.topic.name}</p>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5 text-[1.05rem]">
                    {confidenceEmojis(row.topic.confidence).map((item, index) => (
                      <span key={`${row.topic.id}-${index}`} className={item.active ? '' : 'opacity-30 grayscale'}>
                        {item.emoji}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-4 text-[13px] text-gray-500">{row.recencyLabel}</td>
                <td className="px-5 py-4">
                  <span data-testid="progress-status-chip" className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone(row.status)}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
