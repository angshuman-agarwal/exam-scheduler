import type { Offering, Paper, Subject } from '../types'

export type ExamDayPaperWithSubject = { paper: Paper; subject: Subject; offering: Offering }

function formatExamDayLabel(selectedDay: string) {
  return new Date(`${selectedDay}T00:00:00`).toLocaleDateString('default', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

export function ExamDaySelectionPanel({
  selectedDay,
  papers,
  onSelectPaper,
  onStartPaper,
  className = '',
}: {
  selectedDay: string
  papers: ExamDayPaperWithSubject[]
  onSelectPaper: (offering: Offering, subject: Subject, paper: Paper) => void
  onStartPaper: (offering: Offering, subject: Subject, paper: Paper) => void
  className?: string
}) {
  if (papers.length === 0) return null

  return (
    <div
      data-testid="progress-exam-day-panel"
      className={`border border-black/[0.08] bg-gradient-to-br from-white/[0.85] to-white/[0.72] px-4 py-4 backdrop-blur-xl ${className}`.trim()}
    >
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">
        {formatExamDayLabel(selectedDay)}
      </p>
      <div className="flex flex-col gap-2.5">
        {papers.map((pw) => (
          <div
            key={pw.paper.id}
            className="overflow-hidden rounded-xl border border-white/40 bg-white/[0.7] text-left shadow-[0_2px_8px_rgba(0,0,0,0.04),0_1px_0_rgba(255,255,255,0.6)_inset] backdrop-blur-sm"
          >
            <div className="flex items-stretch">
            <div className="w-1.5 shrink-0" style={{ backgroundColor: pw.subject.color }} />
            <div className="min-w-0 flex-1 px-3.5 py-3">
              <p className="text-sm font-semibold text-gray-900">{pw.subject.name}</p>
              <p className="mt-0.5 text-xs text-gray-600">
                {pw.paper.name}
                <span className="mx-1.5 text-gray-300">{'\u00B7'}</span>
                {pw.offering.label}
              </p>
              <p className="mt-0.5 text-xs text-gray-500">{pw.paper.examTime ?? 'Time TBC'}</p>
            </div>
            </div>
            <div className="flex gap-2 border-t border-black/[0.06] px-3.5 py-3">
              <button
                onClick={() => onStartPaper(pw.offering, pw.subject, pw.paper)}
                className="rounded-lg bg-[linear-gradient(180deg,#2f7cff,#1f63d8)] px-3 py-2 text-xs font-semibold text-white"
              >
                Start full paper
              </button>
              <button
                onClick={() => onSelectPaper(pw.offering, pw.subject, pw.paper)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700"
              >
                Browse topics
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
