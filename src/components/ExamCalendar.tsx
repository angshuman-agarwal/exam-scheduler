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

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={goPrev}
          disabled={!canGoPrev}
          className="p-1.5 rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-25 disabled:cursor-default"
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
          className="p-1.5 rounded-lg text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-25 disabled:cursor-default"
          aria-label="Next month"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
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
                'flex flex-col items-center justify-center py-1.5 rounded-lg min-w-0 transition-colors',
                hasPapers ? 'cursor-pointer hover:bg-gray-100' : 'cursor-default',
                isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-300' : '',
                isToday && !isSelected ? 'ring-1 ring-inset ring-gray-300' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'text-xs leading-none',
                  hasPapers ? 'font-semibold text-gray-900' : 'text-gray-400',
                ].join(' ')}
              >
                {cell.day}
              </span>
              {hasPapers && (
                <div className="flex gap-0.5 mt-1">
                  {papers.map((pw) => (
                    <span
                      key={pw.paper.id}
                      className="w-1.5 h-1.5 rotate-45 rounded-[1px]"
                      style={{ backgroundColor: pw.subject.color }}
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Detail panel */}
      {selectedDay && selectedPapers.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-gray-400 mb-2">
            {new Date(selectedDay + 'T00:00:00').toLocaleDateString('default', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })}
          </p>
          <div className="flex flex-col gap-1.5">
            {selectedPapers.map((pw) => (
              <button
                key={pw.paper.id}
                onClick={() => onSelectPaper(pw.offering, pw.subject, pw.paper)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all active:scale-[0.98]"
                style={{ backgroundColor: pw.subject.color + '14' }}
              >
                <span
                  className="w-2 h-2 rotate-45 rounded-[1px] shrink-0"
                  style={{ backgroundColor: pw.subject.color }}
                />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-gray-900">{pw.subject.name}</span>
                  <span className="text-xs text-gray-400 ml-1.5">{pw.paper.name}</span>
                  <span className="text-xs text-gray-300 ml-1.5">{pw.offering.label}</span>
                  <span className="text-xs text-gray-400 ml-1.5">{pw.paper.examTime ?? 'Time TBC'}</span>
                </div>
                <svg className="w-3.5 h-3.5 shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
