import type { Note } from '../../types'
import { latestSessionScoreLabel, type ProgressCalendarDayMeta } from './analytics'
import { formatDuration } from './shared'

export function ProgressDayDetail({
  meta,
  notes,
}: {
  meta: ProgressCalendarDayMeta | null
  notes: Note[]
}) {
  if (!meta) {
    return <p className="text-[13px] text-slate-500">No study activity recorded for this day.</p>
  }

  const topNotes = notes.slice(0, 2)

  return (
    <div data-testid="progress-day-detail" className="mt-3 space-y-3 border-t border-gray-100 pt-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Sessions</p>
          <p className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-slate-900">{meta.sessionCount}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Study Time</p>
          <p className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-slate-900">{formatDuration(meta.totalDurationSeconds)}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Average Result</p>
          <p className="mt-1 text-[15px] font-semibold tracking-[-0.02em] text-slate-900">
            {meta.averageScore === null ? '—' : `${Math.round(meta.averageScore * 100)}%`}
          </p>
          {meta.averageScore !== null && (
            <p className="mt-1 text-[11px] text-slate-400">{latestSessionScoreLabel(meta.averageScore)}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-white/90 px-3.5 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Studied Subjects</p>
        <p className="mt-1.5 text-[13px] text-slate-700">
          {meta.subjects.map((subject) => subject.name).join(' · ')}
        </p>
        <p className="mt-1 text-[12px] text-slate-500">
          {meta.topicsStudied.length} topic{meta.topicsStudied.length === 1 ? '' : 's'} reviewed
          {meta.notesCount > 0 ? ` · ${meta.notesCount} note${meta.notesCount === 1 ? '' : 's'}` : ''}
        </p>
      </div>

      {topNotes.length > 0 && (
        <div className="space-y-2">
          {topNotes.map((note) => (
            <div key={note.id} className="rounded-xl bg-slate-50/85 px-3 py-2.5">
              <p className="text-[13px] leading-5 text-slate-700">{note.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
