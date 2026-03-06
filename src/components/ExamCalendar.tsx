import { useState, useMemo } from 'react'
import type { Paper, Subject, Offering } from '../types'

export type PaperWithSubject = { paper: Paper; subject: Subject; offering: Offering }

interface ExamCalendarProps {
  examDateMap: Map<string, PaperWithSubject[]>
  onSelectPaper: (offering: Offering, subject: Subject, paper: Paper) => void
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMonthName(date: Date) {
  return date.toLocaleString('default', { month: 'long', year: 'numeric' })
}

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export default function ExamCalendar({ examDateMap, onSelectPaper }: ExamCalendarProps) {
  const { firstExamMonth, lastExamMonth } = useMemo(() => {
    const dates = [...examDateMap.keys()].sort()
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
  }, [examDateMap])

  const [currentMonth, setCurrentMonth] = useState(() => firstExamMonth)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const today = new Date()
  const todayKey = toDateKey(today.getFullYear(), today.getMonth(), today.getDate())

  const canGoPrev = !sameMonth(currentMonth, firstExamMonth)
  const canGoNext = !sameMonth(currentMonth, lastExamMonth)

  function goPrev() {
    if (!canGoPrev) return
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    setSelectedDay(null)
  }

  function goNext() {
    if (!canGoNext) return
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    setSelectedDay(null)
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

  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900">Exam Calendar</h2>
      <p className="text-xs text-gray-400 mt-0.5 mb-3">Tap a date to see exams and plan topics to study</p>

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
            const isToday = cell.key === todayKey
            const isSelected = cell.key === selectedDay

            return (
              <button
                key={cell.key}
                onClick={() => hasPapers && setSelectedDay(isSelected ? null : cell.key)}
                disabled={!hasPapers}
                className={[
                  'flex flex-col items-center justify-center py-2 rounded-xl min-w-0 transition-colors',
                  hasPapers ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default',
                  isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : '',
                  isToday && !isSelected ? 'ring-1 ring-inset ring-gray-200' : '',
                ].join(' ')}
              >
                <span
                  className={[
                    'text-sm leading-none',
                    hasPapers ? 'font-semibold text-gray-900' : 'text-gray-400',
                  ].join(' ')}
                >
                  {cell.day}
                </span>
                {hasPapers && (
                  <div className="flex gap-0.5 mt-1.5">
                    {papers.map((pw) => (
                      <span
                        key={pw.paper.id}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: pw.subject.color }}
                      />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Inline detail sheet */}
      {selectedDay && selectedPapers.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">
            {new Date(selectedDay + 'T00:00:00').toLocaleDateString('default', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          <div className="flex flex-col gap-2">
            {selectedPapers.map((pw) => (
              <button
                key={pw.paper.id}
                onClick={() => onSelectPaper(pw.offering, pw.subject, pw.paper)}
                className="flex items-stretch rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden text-left transition-all active:scale-[0.98] hover:border-gray-200"
              >
                <div className="w-1.5 shrink-0" style={{ backgroundColor: pw.subject.color }} />
                <div className="flex-1 px-3.5 py-3 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{pw.subject.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {pw.paper.name}
                    <span className="text-gray-300 mx-1.5">{'\u00B7'}</span>
                    {pw.offering.label}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{pw.paper.examTime ?? 'Time TBC'}</p>
                </div>
                <div className="flex items-center pr-3">
                  <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
    </div>
  )
}
