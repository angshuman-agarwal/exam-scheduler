import { daysRemaining } from '../../lib/engine'
import type { Paper } from '../../types'

function pastel(hex: string, alpha = 0.08): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

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
        {sorted.map((p, i) => {
          const isNearest = i === nearestIdx
          return (
            <div key={p.id} className="flex items-center justify-between gap-2">
              <span className={`text-sm shrink-0 ${isNearest ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>
                {p.name}
              </span>
              <div className="flex items-center gap-2">
                {isNearest && (
                  <span
                    className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                    style={{ color: subjectColor, backgroundColor: pastel(subjectColor, 0.12) }}
                  >
                    Next
                  </span>
                )}
                <span className={`text-xs tabular-nums ${isNearest ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                  {fmtDate(p.examDate)}
                </span>
                <span className={`text-xs tabular-nums ${isNearest ? 'text-gray-500' : 'text-gray-300'}`}>
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

