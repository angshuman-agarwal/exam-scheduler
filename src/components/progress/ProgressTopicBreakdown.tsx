import { useState } from 'react'
import { type ProgressTableFilter, type ProgressTableRow, type TopicTableRow } from './analytics'
import { confidenceEmojis, statusTone } from './shared'

function formatCompactStudyTime(totalSeconds: number): string | null {
  if (totalSeconds <= 0) return null
  const totalMinutes = Math.round(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const totalHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes === 0 ? `${totalHours}h` : `${totalHours}h ${minutes}m`
}

function SessionTrendPill({
  score,
  trend,
  totalDurationSeconds,
}: {
  score: number | null
  trend: 'up' | 'flat' | 'down' | null
  totalDurationSeconds: number
}) {
  if (score === null) return null

  const pct = Math.round(score * 100)
  const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'
  const arrowColor = trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-orange-500' : 'text-gray-500'
  const timeLabel = formatCompactStudyTime(totalDurationSeconds)

  return (
    <span className="mt-1.5 block text-[10px] text-gray-400">
      <span data-testid="progress-session-trend-pill" className="inline-flex items-center gap-0.5">
        Last: <span className="ml-0.5 font-medium text-gray-500">{pct}%</span>
        <span className={`text-[11px] font-bold ${arrowColor}`}>{arrow}</span>
      </span>
      {timeLabel ? (
        <span data-testid="progress-study-time-label" className="mt-0.5 block">
          Studied <span className="font-medium text-gray-500">{timeLabel}</span>
        </span>
      ) : null}
    </span>
  )
}

function ActionCell({
  row,
  onPlanNow,
  onOpenNote,
}: {
  row: ProgressTableRow
  onPlanNow?: (row: TopicTableRow) => void
  onOpenNote: (row: ProgressTableRow) => void
}) {
  const hasNote = !!row.noteText

  if (row.kind === 'topic' && row.status === 'Not Started' && onPlanNow) {
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
    <div className="flex flex-col items-start">
      <span data-testid="progress-status-chip" className={`inline-flex whitespace-nowrap rounded-full border bg-white px-3 py-1 text-[11px] font-semibold shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_6px_12px_rgba(15,23,42,0.04)] ${statusTone(row.status)}`}>
        {row.actionLabel}
      </span>
      {hasNote ? (
        <button
          type="button"
          data-testid="progress-notes-pill"
          onClick={() => onOpenNote(row)}
          className="mt-2 inline-flex items-center self-start rounded-full bg-[linear-gradient(180deg,#2f7cff,#1f63d8)] px-2.5 py-1 text-[10px] font-semibold text-white shadow-[0_10px_20px_rgba(37,95,216,0.22)] transition-transform hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7cff]/25"
        >
          Notes
        </button>
      ) : null}
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
  rows: ProgressTableRow[]
  filter: ProgressTableFilter
  onFilterChange: (next: ProgressTableFilter) => void
  onPlanNow?: (row: TopicTableRow) => void
  recentlyReviewedLabel?: string
  priorityDisabled?: boolean
  onClearReviewedDate?: () => void
}) {
  const isDateFiltered = recentlyReviewedLabel !== 'Recently Reviewed'
  const [activeNoteRow, setActiveNoteRow] = useState<ProgressTableRow | null>(null)
  const activeNoteTitle = activeNoteRow
    ? `${activeNoteRow.subject.name} · ${activeNoteRow.kind === 'paper' ? activeNoteRow.paper.name : activeNoteRow.topic.name}`
    : null
  const activeTaggedTopics = activeNoteRow?.kind === 'paper' ? activeNoteRow.taggedTopics : []

  return (
    <>
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
              <tr key={row.kind === 'paper' ? row.attempt.id : row.topic.id} data-testid="progress-topic-row" className="border-t border-black/[0.06] align-top transition-colors hover:bg-black/[0.01]">
                <td className="px-5 py-3.5">
                  <div className="flex items-start gap-3">
                    <span
                      data-testid="progress-subject-color-bar"
                      className="mt-1 h-8 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: row.subject.color }}
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold tracking-[-0.02em] text-gray-900">{row.subject.name}</p>
                      <p className="mt-0.5 text-[13px] text-gray-500">{row.kind === 'paper' ? row.paper.name : row.topic.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5 text-[1.05rem]">
                    {confidenceEmojis(row.kind === 'paper' ? row.confidence : row.topic.confidence).map((item, index) => (
                      <span key={`${row.kind === 'paper' ? row.attempt.id : row.topic.id}-${index}`} className={item.active ? '' : 'opacity-30 grayscale'}>
                        {item.emoji}
                      </span>
                    ))}
                  </div>
                  {row.kind === 'topic' ? (
                    <>
                      <SessionTrendPill score={row.lastSessionScore} trend={row.sessionTrend} totalDurationSeconds={row.totalDurationSeconds} />
                      <span data-testid="progress-mastery-percent" className="mt-0.5 block text-[10px] text-gray-400">
                        {row.masteryPercent}% mastery
                      </span>
                    </>
                  ) : row.lastScorePercent !== null ? (
                    <>
                      <span data-testid="progress-paper-score" className="mt-1 block text-[10px] text-gray-400">
                        Last: <span className="font-medium text-gray-500">{row.lastScorePercent}%</span>
                      </span>
                      {formatCompactStudyTime(row.totalDurationSeconds) ? (
                        <span data-testid="progress-study-time-label" className="mt-0.5 block text-[10px] text-gray-400">
                          Studied <span className="font-medium text-gray-500">{formatCompactStudyTime(row.totalDurationSeconds)}</span>
                        </span>
                      ) : null}
                      {row.attemptCount > 1 ? (
                        <span data-testid="progress-paper-attempt-count" className="mt-0.5 block text-[10px] text-gray-400">
                          {row.attemptCount} attempts {row.recencyLabel.toLowerCase()}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span data-testid="progress-paper-score" className="mt-1 block text-[10px] text-gray-400">
                        Full paper logged
                      </span>
                      {row.attemptCount > 1 ? (
                        <span data-testid="progress-paper-attempt-count" className="mt-0.5 block text-[10px] text-gray-400">
                          {row.attemptCount} attempts {row.recencyLabel.toLowerCase()}
                        </span>
                      ) : null}
                    </>
                  )}
                </td>
                <td className="px-5 py-3.5 text-[13px] text-gray-500">{row.recencyLabel}</td>
                <td className="px-5 py-3.5">
                  <ActionCell row={row} onPlanNow={onPlanNow} onOpenNote={setActiveNoteRow} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div data-testid="progress-topic-breakdown-mobile" className="sm:hidden">
        <div className="divide-y divide-black/[0.06]">
          {rows.map((row) => (
            <article key={row.kind === 'paper' ? row.attempt.id : row.topic.id} data-testid="progress-topic-row-mobile" className="px-4 py-3.5">
              <div className="flex items-start gap-3 min-w-0">
                <span
                  data-testid="progress-subject-color-bar"
                  className="mt-1 h-8 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.subject.color }}
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold tracking-[-0.02em] text-gray-900">{row.subject.name}</p>
                  <p className="mt-0.5 text-[13px] leading-5 text-gray-500">{row.kind === 'paper' ? row.paper.name : row.topic.name}</p>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">Overall Confidence</p>
                  <span className="mt-0.5 block text-[10px] text-gray-400">How well you know it</span>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[1.05rem]">
                    {confidenceEmojis(row.kind === 'paper' ? row.confidence : row.topic.confidence).map((item, index) => (
                      <span key={`${row.kind === 'paper' ? row.attempt.id : row.topic.id}-mobile-${index}`} className={item.active ? '' : 'opacity-30 grayscale'}>
                        {item.emoji}
                      </span>
                    ))}
                  </div>
                  {row.kind === 'topic' ? (
                    <>
                      <SessionTrendPill score={row.lastSessionScore} trend={row.sessionTrend} totalDurationSeconds={row.totalDurationSeconds} />
                      <span data-testid="progress-mastery-percent" className="mt-0.5 block text-[10px] text-gray-400">
                        {row.masteryPercent}% mastery
                      </span>
                    </>
                  ) : row.lastScorePercent !== null ? (
                    <>
                      <span data-testid="progress-paper-score" className="mt-0.5 block text-[10px] text-gray-400">
                        Last: {row.lastScorePercent}%
                      </span>
                      {formatCompactStudyTime(row.totalDurationSeconds) ? (
                        <span data-testid="progress-study-time-label" className="mt-0.5 block text-[10px] text-gray-400">
                          Studied <span className="font-medium text-gray-500">{formatCompactStudyTime(row.totalDurationSeconds)}</span>
                        </span>
                      ) : null}
                      {row.attemptCount > 1 ? (
                        <span data-testid="progress-paper-attempt-count" className="mt-0.5 block text-[10px] text-gray-400">
                          {row.attemptCount} attempts {row.recencyLabel.toLowerCase()}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <span data-testid="progress-paper-score" className="mt-0.5 block text-[10px] text-gray-400">
                        Full paper logged
                      </span>
                      {row.attemptCount > 1 ? (
                        <span data-testid="progress-paper-attempt-count" className="mt-0.5 block text-[10px] text-gray-400">
                          {row.attemptCount} attempts {row.recencyLabel.toLowerCase()}
                        </span>
                      ) : null}
                    </>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">Action</p>
                  <span className="mt-0.5 block text-[10px] text-gray-400">What to do now</span>
                  <div className="mt-1.5">
                    <ActionCell row={row} onPlanNow={onPlanNow} onOpenNote={setActiveNoteRow} />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
      </section>

      {activeNoteRow && activeNoteRow.noteText ? (
        <div
          data-testid="progress-note-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.24)] px-4 py-6 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="Study note"
        >
          <div className="w-full max-w-md rounded-[1.5rem] border border-black/[0.06] bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.18)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Saved Note</p>
                <h3 className="mt-1 text-[1rem] font-bold tracking-[-0.03em] text-gray-900">{activeNoteTitle}</h3>
              </div>
              <button
                type="button"
                data-testid="progress-note-overlay-close"
                onClick={() => setActiveNoteRow(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-[16px] text-gray-500 transition-colors hover:bg-black/[0.08] hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f7cff]/25"
                aria-label="Close notes"
              >
                ×
              </button>
            </div>
            <div
              data-testid="progress-note-overlay-body"
              className="mt-3 whitespace-pre-wrap break-words rounded-[1.15rem] bg-[#f8fafc] px-3.5 py-3 text-[13px] leading-6 text-gray-600 sm:text-[14px]"
            >
              {activeNoteRow.noteText}
            </div>
            {activeTaggedTopics.length > 0 ? (
              <div className="mt-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Weak topics</p>
                <div data-testid="progress-note-overlay-tagged-topics" className="mt-2 flex flex-wrap gap-2">
                  {activeTaggedTopics.map((topic) => (
                    <span
                      key={topic.id}
                      className="inline-flex items-center rounded-full border border-[#f59e0b]/20 bg-[linear-gradient(180deg,#fff8ea_0%,#fff1cf_100%)] px-3 py-1 text-[11px] font-medium text-[#b86a00] shadow-[0_6px_16px_rgba(217,119,6,0.12)]"
                    >
                      {topic.name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
