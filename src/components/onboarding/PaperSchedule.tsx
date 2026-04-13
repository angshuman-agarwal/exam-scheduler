import { daysRemaining } from '../../lib/engine'
import type { Paper } from '../../types'

export default function PaperSchedule({ papers, subjectColor }: { papers: Paper[]; subjectColor: string }) {
  if (papers.length === 0) {
    return (
      <div className="mt-4 rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
        <p className="text-xs text-gray-400">Exam schedule not added yet</p>
      </div>
    )
  }

  const today = new Date()
  const sorted = [...papers].sort((a, b) =>
    a.examDate !== b.examDate
      ? a.examDate.localeCompare(b.examDate)
      : (a.examTime ?? '').localeCompare(b.examTime ?? '')
  )
  const fmtDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const fmtTime = (t?: string) => t ?? 'Time TBC'

  const todayISO = today.toISOString().slice(0, 10)
  const nearestIdx = sorted.findIndex((p) => p.examDate >= todayISO)
  const nearestDays = nearestIdx >= 0 ? daysRemaining(sorted[nearestIdx].examDate, today) : null
  const nearestPaper = nearestIdx >= 0 ? sorted[nearestIdx] : null

  return (
    <div className="mt-4 rounded-xl bg-gray-50/80 border border-gray-100 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2">
        {sorted.length} {sorted.length === 1 ? 'paper' : 'papers'}
        {nearestDays !== null && nearestPaper && (
          <span className="normal-case tracking-normal font-normal text-gray-400">
            {' \u00B7 '}First exam {fmtDate(nearestPaper.examDate)}{' '}
            {nearestPaper.examTime ? `at ${nearestPaper.examTime}` : '\u00B7 Time TBC'}
          </span>
        )}
      </p>
      <div className="flex flex-col gap-1.5">
        {sorted.map((p) => {
          return (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: subjectColor }} />
                <span className="text-sm text-gray-700 font-medium">{p.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-gray-600">
                  {fmtDate(p.examDate)}
                </span>
                <span className="text-xs tabular-nums text-gray-400">
                  {fmtTime(p.examTime)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

