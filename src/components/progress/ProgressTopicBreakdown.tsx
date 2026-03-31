import { type ProgressTableFilter, type TopicTableRow } from './analytics'
import { confidenceEmojis, statusTone } from './shared'

function SessionTrendPill({
  score,
  trend,
}: {
  score: number | null
  trend: 'up' | 'flat' | 'down' | null
}) {
  if (score === null) return null

  const pct = Math.round(score * 100)
  const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'
  const arrowColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-orange-500' : 'text-gray-500'

  return (
    <span data-testid="progress-session-trend-pill" className="mt-1.5 inline-flex items-center gap-0.5 text-[10px] text-gray-400">
      Last: <span className="ml-0.5 font-medium text-gray-500">{pct}%</span>
      <span className={`text-[11px] font-bold ${arrowColor}`}>{arrow}</span>
    </span>
  )
}

function ActionCell({
  row,
  onPlanNow,
}: {
  row: TopicTableRow
  onPlanNow?: (row: TopicTableRow) => void
}) {
  if (row.status === 'Not Started' && onPlanNow) {
    return (
      <div>
        <button
          type="button"
          data-testid="progress-plan-now"
          onClick={() => onPlanNow(row)}
          className="inline-flex whitespace-nowrap rounded-full bg-[linear-gradient(180deg,#2f7cff,#1f63d8)] px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-[0_10px_20px_rgba(37,95,216,0.22)] transition-transform hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7cff]/30"
        >
          {row.actionLabel}
        </button>
        {row.actionReason ? (
          <span data-testid="progress-action-reason" className="mt-1 block text-[10px] text-gray-400">
            {row.actionReason}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div>
      <span data-testid="progress-status-chip" className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone(row.status)}`}>
        {row.actionLabel}
      </span>
      {row.actionReason ? (
        <span data-testid="progress-action-reason" className="mt-1 block text-[10px] text-gray-400">
          {row.actionReason}
        </span>
      ) : null}
    </div>
  )
}

export function ProgressTopicBreakdown({
  rows,
  filter,
  onFilterChange,
  onPlanNow,
  recentlyReviewedLabel = 'Recently Reviewed',
  priorityDisabled = false,
  onClearReviewedDate,
}: {
  rows: TopicTableRow[]
  filter: ProgressTableFilter
  onFilterChange: (next: ProgressTableFilter) => void
  onPlanNow?: (row: TopicTableRow) => void
  recentlyReviewedLabel?: string
  priorityDisabled?: boolean
  onClearReviewedDate?: () => void
}) {
  const isDateFiltered = recentlyReviewedLabel !== 'Recently Reviewed'

  return (
    <section className="rounded-[1.4rem] border border-black/[0.055] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.055)]">
      <div className="flex flex-col gap-3 border-b border-black/[0.06] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Breakdown</p>
          <h2 className="mt-1 text-[1.15rem] font-bold tracking-[-0.035em] text-gray-900">Topic Mastery</h2>
        </div>
        <div className="flex items-center gap-0 rounded-full bg-black/[0.06] p-[3px]">
          <button
            type="button"
            data-testid="progress-filter-recently-reviewed"
            onClick={() => {
              if (isDateFiltered && onClearReviewedDate) {
                onClearReviewedDate()
                return
              }
              onFilterChange('recently-reviewed')
            }}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
              filter === 'recently-reviewed'
                ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
                : 'text-gray-500'
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <span>{recentlyReviewedLabel}</span>
              {isDateFiltered ? (
                <span
                  data-testid="progress-clear-reviewed-date"
                  aria-hidden="true"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-black/[0.05] text-[10px] text-gray-500"
                >
                  ×
                </span>
              ) : null}
            </span>
          </button>
          <button
            type="button"
            data-testid="progress-filter-priority-now"
            onClick={() => onFilterChange('priority-now')}
            disabled={priorityDisabled}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all ${
              filter === 'priority-now'
                ? 'bg-white text-gray-900 shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
                : 'text-gray-500'
            } ${priorityDisabled ? 'cursor-not-allowed opacity-45' : ''}`}
          >
            Priority Now
          </button>
        </div>
      </div>

      <div className="hidden max-h-[32rem] overflow-auto sm:block">
        <table data-testid="progress-topic-table" className="min-w-full border-collapse">
          <thead>
            <tr className="border-b border-black/[0.06] text-left">
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Subject & Topic</th>
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">
                Overall Confidence
                <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-gray-400">How well you know it</span>
              </th>
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Recency</th>
              <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">
                Action
                <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-gray-400">What to do now</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.topic.id} data-testid="progress-topic-row" className="border-t border-black/[0.06] align-top hover:bg-black/[0.01] transition-colors">
                <td className="px-5 py-3.5">
                  <p className="text-[13px] font-semibold tracking-[-0.02em] text-gray-900">{row.subject.name}</p>
                  <p className="mt-0.5 text-[13px] text-gray-500">{row.topic.name}</p>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5 text-[1.05rem]">
                    {confidenceEmojis(row.topic.confidence).map((item, index) => (
                      <span key={`${row.topic.id}-${index}`} className={item.active ? '' : 'opacity-30 grayscale'}>
                        {item.emoji}
                      </span>
                    ))}
                  </div>
                  <SessionTrendPill score={row.lastSessionScore} trend={row.sessionTrend} />
                  <span data-testid="progress-mastery-percent" className="mt-0.5 block text-[10px] text-gray-400">
                    {row.masteryPercent}% mastery
                  </span>
                </td>
                <td className="px-5 py-3.5 text-[13px] text-gray-500">{row.recencyLabel}</td>
                <td className="px-5 py-3.5">
                  <ActionCell row={row} onPlanNow={onPlanNow} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div data-testid="progress-topic-breakdown-mobile" className="sm:hidden">
        <div className="divide-y divide-black/[0.06]">
          {rows.map((row) => (
            <article key={row.topic.id} data-testid="progress-topic-row-mobile" className="px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold tracking-[-0.02em] text-gray-900">{row.subject.name}</p>
                <p className="mt-0.5 text-[13px] leading-5 text-gray-500">{row.topic.name}</p>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">Overall Confidence</p>
                  <span className="mt-0.5 block text-[10px] text-gray-400">How well you know it</span>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[1.05rem]">
                    {confidenceEmojis(row.topic.confidence).map((item, index) => (
                      <span key={`${row.topic.id}-mobile-${index}`} className={item.active ? '' : 'opacity-30 grayscale'}>
                        {item.emoji}
                      </span>
                    ))}
                  </div>
                  <SessionTrendPill score={row.lastSessionScore} trend={row.sessionTrend} />
                  <span data-testid="progress-mastery-percent" className="mt-0.5 block text-[10px] text-gray-400">
                    {row.masteryPercent}% mastery
                  </span>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">Action</p>
                  <span className="mt-0.5 block text-[10px] text-gray-400">What to do now</span>
                  <div className="mt-1.5">
                    <ActionCell row={row} onPlanNow={onPlanNow} />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
