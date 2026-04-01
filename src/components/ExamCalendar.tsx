import { useState, useMemo, type ReactNode } from 'react'
import type { Paper, Subject, Offering } from '../types'
import { ExamDaySelectionPanel } from './ExamDaySelectionPanel'

export type PaperWithSubject = { paper: Paper; subject: Subject; offering: Offering }
export interface CalendarDateMeta {
  dotColor?: string
  markerLabel?: string
}

interface ExamCalendarProps {
  examDateMap: Map<string, PaperWithSubject[]>
  onSelectPaper: (offering: Offering, subject: Subject, paper: Paper) => void
  onStartPaper?: (offering: Offering, subject: Subject, paper: Paper) => void
  title?: string
  subtitle?: string
  dateMetaMap?: Map<string, CalendarDateMeta>
  renderSelectedDayContent?: (selectedDay: string) => ReactNode
  onSelectedDayChange?: (selectedDay: string | null) => void
  showInlineDetail?: boolean
  showTodayOutline?: boolean
  selectedDay?: string | null
  className?: string
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMonthName(date: Date) {
  return date.toLocaleString('default', { month: 'long', year: 'numeric' })
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function sortDateKeys(keys: string[]) {
  return [...keys].sort((a, b) => {
    const aTime = new Date(`${a}T00:00:00`).getTime()
    const bTime = new Date(`${b}T00:00:00`).getTime()
    return aTime - bTime
  })
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function isBeforeMonth(a: Date, b: Date) {
  return a.getFullYear() < b.getFullYear() || (a.getFullYear() === b.getFullYear() && a.getMonth() < b.getMonth())
}

function isAfterMonth(a: Date, b: Date) {
  return a.getFullYear() > b.getFullYear() || (a.getFullYear() === b.getFullYear() && a.getMonth() > b.getMonth())
}

export default function ExamCalendar({
  examDateMap,
  onSelectPaper,
  onStartPaper,
  title = 'Exam Calendar',
  subtitle = 'Tap a date to see exams and plan topics to study',
  dateMetaMap,
  renderSelectedDayContent,
  onSelectedDayChange,
  showInlineDetail = true,
  showTodayOutline = true,
  selectedDay: controlledSelectedDay,
  className = '',
}: ExamCalendarProps) {
  const { firstExamMonth, lastExamMonth } = useMemo(() => {
    const dates = sortDateKeys([...new Set([...examDateMap.keys(), ...(dateMetaMap ? [...dateMetaMap.keys()] : [])])])
    if (dates.length === 0) {
      const now = new Date()
      return {
        firstExamMonth: new Date(now.getFullYear(), now.getMonth(), 1),
        lastExamMonth: new Date(now.getFullYear(), now.getMonth(), 1),
      }
    }
    const first = new Date(dates[0] + 'T00:00:00')
    const last = new Date(dates[dates.length - 1] + 'T00:00:00')
    return {
      firstExamMonth: new Date(first.getFullYear(), first.getMonth(), 1),
      lastExamMonth: new Date(last.getFullYear(), last.getMonth(), 1),
    }
  }, [dateMetaMap, examDateMap])

  const [rawCurrentMonth, setCurrentMonth] = useState(() => {
    const todayMonth = monthStart(new Date())
    if (isBeforeMonth(todayMonth, firstExamMonth)) return firstExamMonth
    if (isAfterMonth(todayMonth, lastExamMonth)) return lastExamMonth
    return todayMonth
  })
  const [uncontrolledSelectedDay, setUncontrolledSelectedDay] = useState<string | null>(null)
  const selectedDay = controlledSelectedDay !== undefined ? controlledSelectedDay : uncontrolledSelectedDay
  const currentMonth = useMemo(() => {
    if (isBeforeMonth(rawCurrentMonth, firstExamMonth)) return firstExamMonth
    if (isAfterMonth(rawCurrentMonth, lastExamMonth)) return lastExamMonth
    return rawCurrentMonth
  }, [firstExamMonth, lastExamMonth, rawCurrentMonth])

  const today = new Date()
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate())

  const canGoPrev = !sameMonth(currentMonth, firstExamMonth)
  const canGoNext = !sameMonth(currentMonth, lastExamMonth)

  function goPrev() {
    if (!canGoPrev) return
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    if (controlledSelectedDay === undefined) setUncontrolledSelectedDay(null)
    onSelectedDayChange?.(null)
  }

  function goNext() {
    if (!canGoNext) return
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    if (controlledSelectedDay === undefined) setUncontrolledSelectedDay(null)
    onSelectedDayChange?.(null)
  }

  const cells = useMemo(() => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()

    let startDow = firstDay.getDay() - 1
    if (startDow < 0) startDow = 6

    const grid: (null | { day: number; key: string })[] = []
    for (let i = 0; i < startDow; i++) grid.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      grid.push({ day: d, key: toDateKey(year, month, d) })
    }
    return grid
  }, [currentMonth])

  const selectedPapers = selectedDay ? examDateMap.get(selectedDay) ?? [] : []
  const selectedMeta = selectedDay ? dateMetaMap?.get(selectedDay) ?? null : null

  return (
    <div className={className}>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="text-xs text-gray-400 mt-0.5 mb-3">{subtitle}</p>

    <div className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
      {/* Month header bar */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50/60 border-b border-gray-100">
        <button
          onClick={goPrev}
          disabled={!canGoPrev}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-white hover:shadow-sm disabled:opacity-25 disabled:cursor-default"
          aria-label="Previous month"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-sm font-semibold text-gray-700">{getMonthName(currentMonth)}</h2>
        <button
          onClick={goNext}
          disabled={!canGoNext}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-white hover:shadow-sm disabled:opacity-25 disabled:cursor-default"
          aria-label="Next month"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Calendar body */}
      <div className="px-4 pt-3 pb-4">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-y-0.5">
          {cells.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} />

            const papers = examDateMap.get(cell.key)
            const hasPapers = papers && papers.length > 0
            const meta = dateMetaMap?.get(cell.key)
            const hasMeta = !!meta
            const isToday = cell.key === todayKey
            const isSelected = cell.key === selectedDay

            return (
              <button
                key={cell.key}
                data-date-key={cell.key}
                onClick={() => {
                  if (!hasPapers && !hasMeta) return
                  const nextSelectedDay = isSelected ? null : cell.key
                  if (controlledSelectedDay === undefined) setUncontrolledSelectedDay(nextSelectedDay)
                  onSelectedDayChange?.(nextSelectedDay)
                }}
                disabled={!hasPapers && !hasMeta}
                aria-pressed={isSelected}
                className={[
                  'flex flex-col items-center justify-center py-2 rounded-xl min-w-0 transition-colors outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-1',
                  hasPapers || hasMeta ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default',
                  isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : '',
                  showTodayOutline && isToday && !isSelected ? 'ring-1 ring-inset ring-gray-200' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'text-sm leading-none',
                    hasPapers || hasMeta ? 'font-semibold text-gray-900' : 'text-gray-400',
                  ].join(' ')}
                >
                  {cell.day}
                </span>
                {(hasPapers || hasMeta) && (
                  <div className="flex gap-0.5 mt-1.5">
                    {papers?.map((pw) => (
                      <span
                        key={pw.paper.id}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: pw.subject.color }}
                      />
                    ))}
                    {hasMeta && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: meta?.dotColor ?? '#2563eb' }}
                        aria-label={meta?.markerLabel ?? 'Study activity'}
                      />
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Inline detail sheet — liquid glass effect */}
      {showInlineDetail && selectedDay && (selectedPapers.length > 0 || selectedMeta || renderSelectedDayContent) && (
        <div className="border-t border-black/[0.08] bg-gradient-to-br from-white/[0.85] to-white/[0.72] backdrop-blur-xl px-4 py-4">
          {selectedPapers.length > 0 && (
            <ExamDaySelectionPanel
              selectedDay={selectedDay}
              papers={selectedPapers}
              onSelectPaper={onSelectPaper}
              onStartPaper={onStartPaper ?? onSelectPaper}
              className="border-0 bg-transparent p-0 shadow-none"
            />
          )}
          {renderSelectedDayContent?.(selectedDay)}
        </div>
      )}
    </div>
    </div>
  )
}
