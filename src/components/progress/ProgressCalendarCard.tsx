import ExamCalendar, { type CalendarDateMeta, type PaperWithSubject } from '../ExamCalendar'
import { type ProgressCalendarDayMeta } from './analytics'

export function ProgressCalendarCard({
  examDateMap,
  dateMetaMap,
  onSelectPaper,
  onSelectedDayChange,
}: {
  examDateMap: Map<string, PaperWithSubject[]>
  dateMetaMap: Map<string, ProgressCalendarDayMeta>
  onSelectPaper: (paper: PaperWithSubject) => void
  onSelectedDayChange: (selectedDay: string | null) => void
}) {
  const calendarMeta = new Map<string, CalendarDateMeta>(
    [...dateMetaMap.keys()].map((dateKey) => [dateKey, { dotColor: '#2563eb', markerLabel: 'Study activity' }]),
  )

  return (
    <article data-testid="progress-calendar-card" className="self-start rounded-[1.4rem] border border-black/[0.055] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.055)]">
      <ExamCalendar
        title="Calendar"
        subtitle="Select a study day to filter the grid or an exam date to browse papers."
        className="space-y-0"
        examDateMap={examDateMap}
        dateMetaMap={calendarMeta}
        onSelectPaper={(offering, subject, paper) => onSelectPaper({ offering, subject, paper })}
        onSelectedDayChange={onSelectedDayChange}
        showInlineDetail={false}
        showTodayOutline={false}
      />
    </article>
  )
}
