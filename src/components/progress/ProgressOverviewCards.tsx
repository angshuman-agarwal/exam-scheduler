import { useMemo, useRef, useState, type ReactNode } from 'react'
import { recencyLabel, type LastSessionSummary, type StudyVelocitySeries } from './analytics'

// Apple-like card: pure white, precise shadow stack, full opacity
function cardClassName() {
  return [
    'min-h-[10.25rem]',
    'sm:min-h-[10.75rem]',
    'rounded-[1.4rem]',
    'border border-black/[0.055]',
    'bg-white',
    'p-4 sm:p-5',
    'shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.055),0_20px_40px_rgba(0,0,0,0.04)]',
    'flex flex-col',
    'overflow-hidden',
  ].join(' ')
}

function sessionScoreEmoji(score: number): string {
  if (score >= 0.8) return '🤩'
  if (score >= 0.6) return '🙂'
  return '😕'
}

function confidenceEmoji(confidence: number): string {
  if (confidence >= 5) return '🤩'
  if (confidence >= 4) return '😊'
  if (confidence >= 3) return '🙂'
  if (confidence >= 2) return '😕'
  return '😟'
}

function velocityDisplayMeta(series: StudyVelocitySeries) {
  const maxRawValue = Math.max(...series.points.map((point) => point.value), 0)
  const useHours = series.unitLabel === 'Minutes studied' && maxRawValue >= 60
  const formatValue = (value: number) => {
    if (series.unitLabel === 'Sessions') return String(value)
    if (useHours) return value === 0 ? '0' : `${Math.round((value / 60) * 10) / 10}`
    return String(Math.round(value))
  }

  return {
    maxRawValue,
    midRawValue: maxRawValue > 0 ? maxRawValue / 2 : 0,
    unitLabel: series.unitLabel === 'Sessions' ? 'Sessions' : useHours ? 'Hours studied' : 'Minutes studied',
    formatValue,
  }
}

function velocityDayLabel(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatCompactStudyTime(totalSeconds: number): string | null {
  if (totalSeconds <= 0) return null
  const totalMinutes = Math.round(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const totalHours = totalMinutes / 60
  if (Number.isInteger(totalHours)) return `${totalHours}h`
  const hours = Math.floor(totalHours)
  const minutes = totalMinutes % 60
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}

function StatCard({
  testId,
  title,
  value,
  suffix,
  sublabel,
  accentText,
  accentColorClass,
  iconTileClassName,
  icon,
}: {
  testId: string
  title: string
  value: string
  suffix?: string
  sublabel?: string
  accentText?: string
  accentColorClass?: string
  iconTileClassName: string
  icon: ReactNode
}) {
  return (
    <article data-testid={testId} className={`${cardClassName()} relative`}>
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-12 w-12 place-items-center rounded-[16px] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_12px_26px_rgba(15,23,42,0.08)] ${iconTileClassName}`}>
          {icon}
        </div>
        {accentText ? (
          <span className={`text-[11px] font-semibold ${accentColorClass ?? 'text-gray-400'}`}>{accentText}</span>
        ) : null}
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">{title}</p>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <strong className="text-[2.35rem] font-bold leading-none tracking-[-0.04em] text-gray-900 sm:text-[2.6rem]">{value}</strong>
        {suffix ? <span className="text-[13px] font-medium text-gray-400">{suffix}</span> : null}
      </div>
      {sublabel ? <p className="mt-auto pt-2 text-[12px] leading-5 text-gray-400">{sublabel}</p> : null}
    </article>
  )
}

export function DailyStreakCard({
  streak,
  deltaText,
}: {
  streak: number
  deltaText: string
}) {
  const activeCount = Math.min(Math.max(streak, 0), 7)

  return (
    <article data-testid="progress-daily-streak-card" className={`${cardClassName()} relative`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-2 h-20 w-20 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,146,67,0.11)_0%,rgba(255,146,67,0.05)_36%,rgba(255,146,67,0)_74%)]"
      />
      <div className="flex items-start justify-between">
        <div className="grid h-12 w-12 place-items-center rounded-[16px] bg-[linear-gradient(180deg,#fff7ef_0%,#ffead5_100%)] text-[#ff5b21] shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_12px_26px_rgba(255,107,0,0.12)]">
          <svg className="h-[2rem] w-[2rem]" viewBox="0 0 100.25 164" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="streakFlameOuter" gradientUnits="userSpaceOnUse" x1="50.1245" y1="0" x2="50.1245" y2="164.0005">
                <stop offset="0" stopColor="#ED1C24" />
                <stop offset="1" stopColor="#F47920" />
              </linearGradient>
              <linearGradient id="streakFlameMid" gradientUnits="userSpaceOnUse" x1="51.7495" y1="32" x2="51.7495" y2="164.0005">
                <stop offset="0" stopColor="#F47920" />
                <stop offset="1" stopColor="#FFC20E" />
              </linearGradient>
              <linearGradient id="streakFlameInner" gradientUnits="userSpaceOnUse" x1="52.333" y1="59" x2="52.333" y2="164.0005">
                <stop offset="0" stopColor="#FFC20E" />
                <stop offset="1" stopColor="#FFF200" />
              </linearGradient>
              <linearGradient id="streakFlameCore" gradientUnits="userSpaceOnUse" x1="54.75" y1="164" x2="54.75" y2="96.833">
                <stop offset="0" stopColor="#FFFFFF" />
                <stop offset="1" stopColor="#FFF200" />
              </linearGradient>
            </defs>
            <path
              fill="url(#streakFlameOuter)"
              d="M50.75,164C33.5,164,0,152.25,0,101c0-36.25,20.5-55.25,20.5-55.25s-1,7.75-1,16.25
                s2.25,16.5,2.25,16.5s0.25-16,9.75-40.25S59,0,59,0s0,18.5,11,35.75s30.25,42.5,30.25,70.75S82.5,164,50.75,164z"
            />
            <path
              fill="url(#streakFlameMid)"
              d="M50.75,164c-20.75,0-39-21.25-39-45.25S14.5,87.5,14.5,87.5s1.75,6.75,9,6.75s1-6.5,10.25-29.75
                s24-32.5,24-32.5s0.5,4,1.5,8s5.5,13.75,10.25,25S75,83.5,75,83.5s2-4.667,3.084-6.417c1.083-1.75,2.416-3.25,2.75-5
                c0.333-1.75-0.417-5.416-0.417-5.416S91.75,84.5,91.75,104.5S86.5,164,50.75,164z"
            />
            <path
              fill="url(#streakFlameInner)"
              d="M50.75,164c-15.917,0-29.25-19.499-29.25-37.833s12-33,12-33s-0.667,5-0.667,9.5
                s3.5,8.833,3.5,8.833S37,94.834,41.5,82.667S57.166,59,57.166,59S57,63.5,59,69.5s24.166,37.666,24.166,52.333S78.5,164,50.75,164z"
            />
            <path
              fill="url(#streakFlameCore)"
              d="M50.75,164c-8.083,0-15.583-9.167-15.583-26.167c0-31.166,25.667-41,25.667-41
                s-1.168,5.166-1.168,10S74.334,129,74.334,141S64.5,164,50.75,164z"
            />
          </svg>
        </div>
        <span className="text-[11px] font-semibold text-[#ff6b00]">{deltaText}</span>
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Daily Streak</p>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <strong className="text-[2.6rem] font-bold leading-none tracking-[-0.04em] text-gray-900">{streak}</strong>
        <span className="text-[13px] font-medium text-gray-400">days</span>
      </div>

      <div className="mt-auto flex items-center gap-[5px] pt-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <span
            key={index}
            className={`h-[4px] flex-1 rounded-full ${
              index < activeCount ? 'bg-[#ff6b00]' : 'bg-black/[0.08]'
            }`}
          />
        ))}
      </div>
    </article>
  )
}

export function TotalStudiedCard({
  totalStudyTime,
}: {
  totalStudyTime: number
}) {
  const displayValue = formatCompactStudyTime(totalStudyTime) ?? '0m'

  return (
    <StatCard
      testId="progress-total-studied-card"
      title="Total Studied"
      value={displayValue}
      sublabel="Across topics and papers"
      iconTileClassName="bg-[linear-gradient(180deg,#eff7ff_0%,#dcebff_100%)] text-[#245fc8]"
      icon={(
        <svg className="h-[1.7rem] w-[1.7rem]" viewBox="0 0 512 512" fill="none" aria-hidden="true">
          <path
            fill="#3C6A98"
            d="M389.021 442.862c6.992.046 13.985.076 20.977.143 4.652.044 7.86 2.866 7.943 7.524.165 9.323.219 18.655-.013 27.975-.151 6.063-2.993 8.486-9.151 8.486-100.088.011-200.176.011-300.264-.001-7.601 0-9.505-1.902-9.511-9.294-.007-9.159-.024-18.319.008-27.478.018-5.365 1.802-7.177 7.061-7.211 6.661-.043 13.323-.03 19.984-.018 4.299-.017 8.675-.075 13.438-.044 60.374.059 120.75.079 181.126.072 17.296-.002 34.592-.078 51.888-.023 4.378-.069 8.756-.138 13.134-.131Z"
          />
          <path
            fill="#3C6A98"
            d="M126.905 71.062c4.531-.2 9.061-.4 13.896-.306 77.926-.281 155.548-.294 233.631-.288 4.517-.155 9.034.018 13.797-.075 6.329-.005 12.658.02 18.987-.024 5.994-.042 8.817-2.608 8.941-8.709.186-9.157.166-18.322.005-27.479-.099-5.601-2.468-7.789-7.968-7.789-101.266-.015-202.533-.016-303.799-.004-5.347.001-7.152 1.804-7.172 7.11-.035 9.327-.02 18.654-.007 27.981.01 6.736 2.074 8.815 8.916 8.888 6.328.068 12.657.052 19.773.695Z"
          />
          <path
            fill="#FDD04C"
            d="M374.893 71.05c4.517-.155 9.034.018 13.797-.075.294 12.934.375 25.598.211 38.259-.355 27.294-6.771 52.951-23.216 75.068-6.625 8.909-15.458 16.195-23.423 24.081-4.221 4.179-8.736 8.061-13.118 12.076-7.9 7.237-15.822 14.452-23.697 21.716-11.391 10.507-11.821 24.036 1.692 34.901 8.077 6.495 15.421 13.901 23.085 20.907 7.9 7.221 16.055 14.188 23.628 21.738 14.791 14.746 24.558 32.4 30.162 52.589 6.386 23.005 4.617 46.455 4.912 69.817-4.378.069-8.756.138-13.498.055-.32-11.704-.373-22.967-1.072-34.19-.568-9.112-1.161-18.336-3.066-27.227-4.097-19.113-12.454-36.162-27.046-49.714-10.659-9.899-21.179-19.948-31.866-29.816-5.065-4.677-10.431-9.027-15.56-13.637-8.868-7.969-14.592-17.665-14.264-29.86.248-9.193 3.87-17.468 10.454-23.918 10.028-9.825 20.456-19.242 30.739-28.806 3.983-3.704 7.856-7.556 12.083-10.964 13.085-10.55 22.903-23.441 29.691-38.859 7.592-17.247 8.725-35.594 9.812-53.921.599-10.117.042-20.302.078-30.457Z"
          />
          <path
            fill="#FDD04C"
            d="M126.947 71.525c4.489-.663 9.02-.863 13.807-.305.282 12.709.447 24.962.999 37.198.376 8.351.55 16.82 2.109 24.988 4.73 24.78 17.632 44.875 36.455 61.494 14.939 13.188 29.724 26.566 44.161 40.297 6.021 5.727 8.969 13.501 9.163 21.909.282 12.22-5.119 21.983-13.931 30.062-7.281 6.675-14.57 13.342-21.925 19.935-4.881 4.376-10.124 8.372-14.782 12.968-9.939 9.804-20.372 19.099-27.406 31.583-11.329 20.107-13.791 42.098-14.834 64.443-.411 8.808-.05 17.653-.041 26.48-4.763-.031-9.139.027-13.438.044.935-10.931.797-21.756.974-32.576.387-23.565 4.988-46.094 16.775-66.831 7.576-13.328 18.197-23.909 29.717-33.76 5.016-4.289 9.715-8.947 14.593-13.399 7.169-6.544 14.319-13.111 21.568-19.566 12.415-11.055 13.041-26.241-1.37-36.259-4.837-3.362-8.882-7.881-13.2-11.965-13.229-12.511-27.028-24.494-39.449-37.764-12.818-13.695-20.18-30.648-24.728-48.88-4.775-19.138-3.87-38.578-3.935-57.99-.013-3.996-.008-7.992-.012-11.988Z"
          />
          <path
            fill="#245FC8"
            d="M141.493 442.922c-.474-8.877-.835-17.721-.424-26.529 1.043-22.345 3.505-44.336 14.834-64.443 7.034-12.484 17.467-21.779 27.406-31.583 4.658-4.596 9.901-8.592 14.782-12.968 7.355-6.593 14.644-13.26 21.925-19.935 8.812-8.079 14.213-17.842 13.931-30.062-.194-8.408-3.142-16.182-9.163-21.909-14.437-13.731-29.222-27.109-44.161-40.297-18.823-16.619-31.725-36.714-36.455-61.494-1.559-8.168-1.733-16.637-2.109-24.988-.552-12.236-.717-24.489-.999-37.198 77.926-.281 155.548-.294 233.631-.288.036 10.155.521 20.34-.078 30.457-1.087 18.327-2.22 36.674-9.812 53.921-6.788 15.418-16.606 28.309-29.691 38.859-4.227 3.408-8.1 7.26-12.083 10.964-10.283 9.564-20.711 18.981-30.739 28.806-6.584 6.45-10.206 14.725-10.454 23.918-.328 12.195 5.396 21.891 14.264 29.86 5.129 4.61 10.495 8.96 15.56 13.637 10.687 9.868 21.207 19.917 31.866 29.816 14.592 13.552 22.949 30.601 27.046 49.714 1.905 8.891 2.498 18.115 3.066 27.227.699 11.223.752 22.486 1.072 34.19-17.296-.055-34.592.021-51.888.023-60.376.007-120.752-.013-181.126-.072Zm44.461-81.352c-2.329 3.127-4.923 6.094-6.941 9.411-8.493 13.96-14.546 28.71-15.092 45.405-.355 10.853 1.018 12.613 12.156 12.613 54.973 0 109.946 0 164.918-.001 1.166 0 2.337.066 3.498-.015 5.99-.419 8.591-3.072 8.456-9.094-.088-3.935-.336-7.918-1.056-11.778-4.599-24.655-16.395-45.13-36.583-60.202-25.607-19.116-54.126-23.519-84.699-15.099-17.567 4.839-31.861 15.038-44.657 28.76Zm90.469-127.476c12.029-11.698 24.032-23.422 36.097-35.082 6.195-5.987 12.768-11.607 18.683-17.855 6.026-6.365 11.619-13.165 17.067-20.04 2.425-3.061 2.173-6.813-.537-9.773-2.67-2.916-5.937-3.005-9.406-1.088-3.432 1.897-6.893 3.793-10.5 5.313-8.713 3.672-17.401 7.244-27.163 7.523-11.179.32-21.818-2.207-32.272-5.444-17.998-5.572-35.993-9.44-55.087-6.805-11.752 1.621-22.93 4.709-33.7 9.388-5.926 2.574-6.75 9.218-1.986 13.857 8.083 7.872 16.288 15.619 24.412 23.449 10.284 9.912 20.539 19.854 30.806 29.784.359.347.662.773 1.069 1.048 7.4 4.998 11.011 12.158 12.129 20.841.882 6.853 5.165 10.694 11.742 10.791 6.098.09 10.962-3.693 12.306-8.499 1.594-5.701 3.952-11.189 6.341-17.407Zm-11.422 48.407c.159-4.533-1.894-7.261-6.53-7.461-4.213-.182-7.256 2.679-7.469 6.658-.211 3.924 2.537 7.63 6.124 8.258 3.713.65 6.922-2.047 7.875-7.455Zm-4.122 34.115c4.268-1.648 4.877-5.438 3.881-8.877-.626-2.166-3.225-4.837-5.309-5.209-2.174-.388-5.538 1.106-6.997 2.902-1.346 1.657-2.02 5.907-.927 7.062 2.095 2.213 5.653 3.041 9.352 4.122Z"
          />
          <path
            fill="#4C91D4"
            d="M186.204 361.31c12.547-13.462 26.841-23.661 44.408-28.5 30.573-8.42 59.092-4.017 84.699 15.099 20.188 15.072 31.984 35.547 36.583 60.202.72 3.86.968 7.843 1.056 11.778.135 6.022-2.466 8.675-8.456 9.094-1.161.081-2.332.015-3.498.015-54.972 0-109.945 0-164.918.001-11.138 0-12.511-1.76-12.156-12.613.546-16.695 6.599-31.445 15.092-45.405 2.018-3.317 4.612-6.284 7.19-9.671Z"
          />
          <path
            fill="#4C91D4"
            d="M276.241 234.413c-2.208 5.899-4.566 11.387-6.16 17.088-1.344 4.806-6.208 8.589-12.306 8.499-6.577-.097-10.86-3.938-11.742-10.791-1.118-8.683-4.729-15.843-12.129-20.841-.407-.275-.71-.701-1.069-1.048-10.267-9.93-20.522-19.872-30.806-29.784-8.124-7.83-16.329-15.577-24.412-23.449-4.764-4.639-3.94-11.283 1.986-13.857 10.77-4.679 21.948-7.767 33.7-9.388 19.094-2.635 37.089 1.233 55.087 6.805 10.454 3.237 21.093 5.764 32.272 5.444 9.762-.279 18.45-3.851 27.163-7.523 3.607-1.52 7.068-3.416 10.5-5.313 3.469-1.917 6.736-1.828 9.406 1.088 2.71 2.96 2.962 6.712.537 9.773-5.448 6.875-11.041 13.675-17.067 20.04-5.915 6.248-12.488 11.868-18.683 17.855-12.065 11.66-24.068 23.384-36.278 35.401Z"
          />
          <path
            fill="#4C91D3"
            d="M265 282.919c-.952 4.989-4.161 7.686-7.874 7.036-3.587-.628-6.335-4.334-6.125-8.258.214-3.979 3.257-6.84 7.47-6.658 4.635.2 6.688 2.928 6.529 7.88Z"
          />
          <path
            fill="#4C91D4"
            d="M260.504 316.776c-3.325-1.241-6.883-2.069-8.978-4.282-1.093-1.154-.419-5.404.927-7.062 1.459-1.796 4.823-3.29 6.997-2.902 2.084.372 4.683 3.043 5.309 5.209.995 3.439.387 7.229-4.255 9.037Z"
          />
        </svg>
      )}
    />
  )
}

export function PapersAttemptedCard({
  totalAttempts,
  weeklyAttempts,
}: {
  totalAttempts: number
  weeklyAttempts: number
}) {
  const accentText = weeklyAttempts > 0 ? `+${weeklyAttempts} this week` : 'No papers this week'
  return (
    <article data-testid="progress-papers-attempted-card" className={`${cardClassName()} relative`}>
      <div className="flex items-start justify-between">
        <div className="grid h-12 w-12 place-items-center rounded-[16px] bg-[linear-gradient(180deg,#fff5f1_0%,#ffe3d8_100%)] text-[#d9604a] shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_12px_26px_rgba(217,96,74,0.12)]">
          <svg className="h-[1.72rem] w-[1.72rem]" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <path d="M30 62H16a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v58a1 1 0 0 1-1 1Z" fill="#FEBC00" />
            <path d="M30 2h-1v44a14 14 0 0 1-14 14v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z" fill="#EDAA03" />
            <path d="M15 7h7v2h-7V7Zm0 6h7v2h-7v-2Zm0 6h7v2h-7v-2Zm0 6h7v2h-7v-2Zm0 6h7v2h-7v-2Zm0 6h7v2h-7v-2Zm0 6h7v2h-7v-2Zm0 6h7v2h-7v-2Zm0 6h7v2h-7v-2Z" fill="#F74E0C" />
            <path d="M33 21h12v32H33V21Z" fill="#F74E0C" />
            <path d="M37 21h4v32h-4V21Z" fill="#FEBC00" />
            <path d="M33 15h12v6H33v-6Z" fill="#DFEAEF" />
            <path d="M35 15h-2v6h12v-2h-6a4 4 0 0 1-4-4Z" fill="#C3D6DD" />
            <path d="M39 8a6 6 0 0 1 6 6v1H33v-1a6 6 0 0 1 6-6Z" fill="#F74E0C" />
            <path d="M40 8.09A5.967 5.967 0 0 0 33 14v1h2v-1a6 6 0 0 1 5-5.91Z" fill="#E03A07" />
            <path d="M40.39 60h-2.78L33 53h12l-4.61 7Z" fill="#F7D694" />
            <path d="M40.39 60 39 62l-1.39-2h2.78Z" fill="#F74E0C" />
          </svg>
        </div>
        <span className="text-[11px] font-semibold text-[#d9604a]">{accentText}</span>
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Papers Attempted</p>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <strong className="text-[2.35rem] font-bold leading-none tracking-[-0.04em] text-gray-900 sm:text-[2.6rem]">{totalAttempts}</strong>
      </div>
      <p className="mt-auto pt-2 text-[12px] leading-5 text-gray-400">Full papers logged</p>
    </article>
  )
}

export function LastSessionCard({
  summary,
  today,
  todayStudyTotal,
}: {
  summary: LastSessionSummary
  today: Date
  todayStudyTotal: number
}) {
  const lastSessionLabel = summary.kind === 'paper' && summary.attempt
    ? recencyLabel(summary.attempt.date, today)
    : summary.session
      ? recencyLabel(summary.session.date, today)
      : 'No session yet'
  const todayStudyLabel = lastSessionLabel === 'Today' ? formatCompactStudyTime(todayStudyTotal) : null

  return (
    <article data-testid="progress-last-session-card" className={cardClassName()}>
      <div className="flex items-start justify-between">
        <div className="grid h-12 w-12 place-items-center rounded-[16px] bg-[linear-gradient(180deg,#f3f8ff_0%,#e3efff_100%)] text-[#2a76e8] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_12px_26px_rgba(52,120,226,0.12)]">
          <svg className="h-[1.65rem] w-[1.65rem]" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="lastSessionBoltOuter" x1="32" y1="6" x2="32" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#4D9BFF" />
                <stop offset="1" stopColor="#296FE0" />
              </linearGradient>
              <linearGradient id="lastSessionBoltInner" x1="32" y1="20" x2="32" y2="44" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#CFE5FF" />
                <stop offset="1" stopColor="#88B8FF" />
              </linearGradient>
            </defs>
            <path
              d="M24.028 58H22.065c-.688 0-1.318-.347-1.688-.927-.369-.582-.416-1.302-.123-1.926L27.011 40H16c-1.188 0-2.232-.673-2.726-1.757-.494-1.086-.313-2.32.471-3.219L38.468 6.684C38.848 6.249 39.396 6 39.971 6h1.964c.687 0 1.316.346 1.686.926.371.581.417 1.302.126 1.926L36.667 24h11.335c1.188 0 2.232.673 2.726 1.757.494 1.086.313 2.32-.471 3.219L25.531 57.316c-.378.434-.926.684-1.503.684Z"
              fill="url(#lastSessionBoltOuter)"
            />
            <path
              d="m31.226 43.457 4.006-8.011c.332-.664-.151-1.446-.894-1.446H23.093c-.849 0-1.313-.99-.769-1.642l9.974-11.968c.393-.472 1.128.038.823.571l-4.311 7.545c-.382.665.099 1.494.866 1.494h11.231c.833 0 1.302.958.79 1.616l-9.625 12.375c-.372.479-1.118.01-.846-.534Z"
              fill="url(#lastSessionBoltInner)"
            />
          </svg>
        </div>
        <div className="flex flex-col items-end text-right leading-tight">
          <span className="text-[11px] font-semibold text-[#007AFF]">{lastSessionLabel}</span>
          {todayStudyLabel ? (
            <span
              data-testid="progress-last-session-today-total"
              className="mt-0.5 text-[15px] font-bold tracking-[-0.02em] text-gray-900 sm:text-[16px]"
            >
              {todayStudyLabel}
            </span>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Last Session</p>
      {summary.kind === 'topic' && summary.session && summary.topic && summary.subject ? (
        <>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <strong className="text-[2.6rem] font-bold leading-none tracking-[-0.04em] text-gray-900">
              {Math.round(summary.session.score * 100)}
            </strong>
            <span className="text-[13px] font-medium text-gray-400">%</span>
            <span className="translate-y-[-1px] text-[1.05rem]" aria-hidden="true">
              {sessionScoreEmoji(summary.session.score)}
            </span>
          </div>
          <p className="mt-auto line-clamp-2 pt-2 text-[14px] font-semibold leading-5 text-gray-900">
            {summary.subject.name}: {summary.topic.name}
          </p>
        </>
      ) : summary.kind === 'paper' && summary.attempt && summary.paper && summary.subject ? (
        <>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            {summary.attempt.rawMark !== undefined && summary.attempt.totalMarks !== undefined && summary.attempt.totalMarks > 0 ? (
              <>
                <strong className="text-[2.6rem] font-bold leading-none tracking-[-0.04em] text-gray-900">
                  {Math.round((summary.attempt.rawMark / summary.attempt.totalMarks) * 100)}
                </strong>
                <span className="text-[13px] font-medium text-gray-400">%</span>
              </>
            ) : (
              <strong className="text-[1.15rem] font-semibold leading-none tracking-[-0.02em] text-gray-900">Full Paper</strong>
            )}
            <span className="translate-y-[-1px] text-[1.05rem]" aria-hidden="true">
              {confidenceEmoji(summary.attempt.confidence)}
            </span>
          </div>
          <p className="mt-auto line-clamp-2 pt-2 text-[14px] font-semibold leading-5 text-gray-900">
            {summary.subject.name} · {summary.paper.name}
          </p>
        </>
      ) : (
        <p className="mt-auto text-[12px] leading-5 text-gray-400">No sessions logged yet.</p>
      )}
    </article>
  )
}

export function StudyVelocityCard({
  value,
  series,
  selectedDay,
  onSelectDay,
}: {
  value: string
  series: StudyVelocitySeries
  selectedDay: string | null
  onSelectDay: (dateKey: string) => void
}) {
  const { maxRawValue, midRawValue, unitLabel, formatValue } = velocityDisplayMeta(series)
  const activePointCount = series.points.filter((point) => point.value > 0).length
  const weekPages = useMemo(() => {
    const midpoint = Math.ceil(series.points.length / 2)
    return [
      { key: 'previous', title: 'Last Week', points: series.points.slice(0, midpoint) },
      { key: 'current', title: 'This Week', points: series.points.slice(midpoint) },
    ]
  }, [series.points])
  const selectedPageIndex = selectedDay
    ? weekPages.findIndex((page) => page.points.some((point) => point.dateKey === selectedDay))
    : -1
  const [mobilePageOverride, setMobilePageOverride] = useState<number | null>(null)
  const touchStartXRef = useRef<number | null>(null)
  const mobilePageIndex = mobilePageOverride ?? (selectedPageIndex >= 0 ? selectedPageIndex : 1)

  const setClampedMobilePage = (next: number) => {
    setMobilePageOverride(Math.max(0, Math.min(weekPages.length - 1, next)))
  }

  const handleTouchStart = (clientX: number) => {
    touchStartXRef.current = clientX
  }
  const handleTouchEnd = (clientX: number) => {
    if (touchStartXRef.current === null) return
    const delta = clientX - touchStartXRef.current
    if (Math.abs(delta) > 36) {
      setClampedMobilePage(delta < 0 ? mobilePageIndex + 1 : mobilePageIndex - 1)
    }
    touchStartXRef.current = null
  }

  const renderVelocityBars = (points: StudyVelocitySeries['points'], isMobile = false) => (
    <div className={`grid h-full min-w-0 items-end ${isMobile ? 'grid-cols-7 gap-1.5' : 'grid-cols-14 gap-1.5 sm:gap-1'}`}>
      {points.map((point) => {
        const isSelected = selectedDay === point.dateKey
        const isClickable = point.value > 0
        const isCurrentWeek = weekPages[1]?.points.some((candidate) => candidate.dateKey === point.dateKey) ?? false
        const isOnlyActivePoint = activePointCount === 1 && isClickable
        const fallbackBarSurfaceClass = isClickable
          ? isCurrentWeek
            ? 'bg-[linear-gradient(180deg,#7bb1ff_0%,#2f7cff_100%)] shadow-[0_8px_18px_rgba(47,124,255,0.24)]'
            : 'bg-[linear-gradient(180deg,#c8ddff_0%,#79acff_100%)] shadow-[0_6px_14px_rgba(80,132,218,0.18)]'
          : 'bg-black/[0.08]'

        return (
          <button
            key={point.dateKey}
            type="button"
            data-testid="progress-velocity-bar"
            data-date-key={point.dateKey}
            data-selected={isSelected ? 'true' : 'false'}
            aria-pressed={isSelected}
            onClick={() => isClickable && onSelectDay(point.dateKey)}
            disabled={!isClickable}
            className={`group grid h-full min-w-0 grid-rows-[minmax(0,1fr)_auto_auto] rounded-[12px] px-[2px] pb-0.5 pt-1.5 text-center outline-none transition-all ${
              isClickable
                ? 'cursor-pointer active:scale-[0.98] hover:bg-[#007AFF]/[0.05] focus-visible:ring-2 focus-visible:ring-[#007AFF]/20'
                : 'cursor-default opacity-55'
            }`}
            title={
              isClickable
                ? `${new Date(`${point.dateKey}T00:00:00`).toLocaleDateString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}: ${formatValue(point.value)} ${unitLabel.toLowerCase()}${
                    point.segments.length > 0
                      ? ` • ${point.segments.map((segment) => `${segment.subjectName} ${formatValue(segment.value)}`).join(', ')}`
                      : ''
                  }`
                : undefined
            }
          >
            <span className="flex h-full items-end">
              <span
                className={`block w-full overflow-hidden rounded-[7px_7px_3px_3px] transition-all ${
                  isSelected
                    ? 'scale-[1.04] ring-2 ring-inset ring-[#007AFF] shadow-[0_12px_24px_rgba(0,122,255,0.26)]'
                    : isClickable
                      ? 'shadow-[0_8px_18px_rgba(0,0,0,0.1)] group-hover:translate-y-[-1px] group-hover:brightness-[1.03]'
                      : ''
                }`}
                style={{ height: `${Math.max(point.heightPercent, 4)}%`, minHeight: '4px' }}
              >
                {point.segments.length > 0 ? (
                  <span className="flex h-full w-full flex-col justify-end">
                    {point.segments
                      .slice()
                      .reverse()
                      .map((segment) => (
                        <span
                          key={`${point.dateKey}-${segment.subjectId}`}
                          className="block w-full"
                          style={{
                            height: `${segment.sharePercent}%`,
                            backgroundColor: segment.color,
                          }}
                        />
                      ))}
                  </span>
                ) : (
                  <span className={`block h-full w-full ${fallbackBarSurfaceClass}`} />
                )}
              </span>
            </span>
            <span
              className={`mt-2 text-[9px] ${
                isSelected ? 'font-bold text-[#007AFF]' : isClickable || isOnlyActivePoint ? 'font-semibold text-gray-600' : 'font-semibold text-gray-400'
              }`}
            >
              {point.shortLabel}
            </span>
            <span className={`mt-0.5 text-[9px] ${isSelected ? 'font-bold text-[#007AFF]' : isClickable ? 'text-gray-500' : 'text-gray-300'}`}>
              {point.dayNumber}
            </span>
          </button>
        )
      })}
    </div>
  )

  return (
    <article data-testid="progress-study-velocity-card" className={`${cardClassName()} col-span-2 lg:h-[15rem]`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Study Velocity</p>
        </div>
        <div className="text-right">
          <p data-testid="progress-velocity-value" className="text-[12px] font-medium text-gray-500">
            <strong className="font-bold text-[#007AFF]">{value}</strong> vs last week
          </p>
          {selectedDay && (
            <p data-testid="progress-velocity-selected-day" className="mt-1 text-[11px] font-bold text-gray-500">
              {velocityDayLabel(selectedDay)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5 hidden flex-1 grid-cols-[2rem_minmax(0,1fr)] gap-2 sm:grid sm:grid-cols-[2.15rem_minmax(0,1fr)]">
        <div className="flex flex-col justify-between pb-7 text-[10px] font-medium text-gray-400">
          <span className="text-[9px] font-semibold uppercase tracking-[0.04em] text-gray-300">{unitLabel === 'Hours studied' ? 'hrs' : unitLabel === 'Minutes studied' ? 'mins' : 'sessions'}</span>
          <span>{maxRawValue > 0 ? formatValue(maxRawValue) : '0'}</span>
          <span>{midRawValue > 0 ? formatValue(midRawValue) : ''}</span>
          <span>0</span>
        </div>
        {renderVelocityBars(series.points)}
      </div>

      <div className="mt-2.5 grid flex-1 grid-cols-[2rem_minmax(0,1fr)] gap-2 sm:hidden">
        <div className="flex flex-col justify-between pb-7 text-[10px] font-medium text-gray-400">
          <span className="text-[9px] font-semibold uppercase tracking-[0.04em] text-gray-300">{unitLabel === 'Hours studied' ? 'hrs' : unitLabel === 'Minutes studied' ? 'mins' : 'sessions'}</span>
          <span>{maxRawValue > 0 ? formatValue(maxRawValue) : '0'}</span>
          <span>{midRawValue > 0 ? formatValue(midRawValue) : ''}</span>
          <span>0</span>
        </div>
        <div
          data-testid="progress-velocity-mobile-carousel"
          className="min-w-0"
          onTouchStart={(event) => handleTouchStart(event.changedTouches[0]?.clientX ?? 0)}
          onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientX ?? 0)}
        >
          {renderVelocityBars(weekPages[mobilePageIndex]?.points ?? [], true)}
        </div>
      </div>

      <div className="mt-2 hidden items-center justify-between text-[10px] font-medium text-gray-400 sm:flex">
        <span>Last Week</span>
        <span>This Week</span>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] font-semibold text-gray-500 sm:hidden">
        <span data-testid="progress-velocity-mobile-week-label">{weekPages[mobilePageIndex]?.title}</span>
      </div>

      <div className="mt-1.5 flex items-center justify-center sm:hidden">
        <div className="flex items-center gap-2">
          {weekPages.map((page, index) => {
            const active = index === mobilePageIndex
            return (
              <button
                key={page.key}
                type="button"
                data-testid="progress-velocity-page-dot"
                aria-label={`Show ${page.title}`}
                aria-pressed={active}
                onClick={() => setClampedMobilePage(index)}
                className={`h-2.5 w-2.5 rounded-full border transition-all ${
                  active
                    ? 'border-[#007AFF]/35 bg-[linear-gradient(180deg,#9bc4ff_0%,#2f7cff_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_4px_10px_rgba(47,124,255,0.28)]'
                    : 'border-black/[0.08] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_6px_rgba(15,23,42,0.08)]'
                }`}
              />
            )
          })}
        </div>
      </div>
    </article>
  )
}

export function ProgressCardsRow({
  streak,
  streakDeltaText,
  paperAttemptsCount,
  weeklyPaperAttemptsCount,
  totalStudyTime,
  lastSession,
  today,
  todayStudyTotal,
  velocityValue,
  velocitySeries,
  selectedDay,
  onSelectVelocityDay,
}: {
  streak: number
  streakDeltaText: string
  paperAttemptsCount: number
  weeklyPaperAttemptsCount: number
  totalStudyTime: number
  lastSession: LastSessionSummary
  today: Date
  todayStudyTotal: number
  velocityValue: string
  velocitySeries: StudyVelocitySeries
  selectedDay: string | null
  onSelectVelocityDay: (dateKey: string) => void
}) {
  return (
    <section className="grid grid-cols-2 items-stretch gap-2.5 sm:gap-3">
      <DailyStreakCard streak={streak} deltaText={streakDeltaText} />
      <TotalStudiedCard totalStudyTime={totalStudyTime} />
      <PapersAttemptedCard totalAttempts={paperAttemptsCount} weeklyAttempts={weeklyPaperAttemptsCount} />
      <LastSessionCard summary={lastSession} today={today} todayStudyTotal={todayStudyTotal} />
      <StudyVelocityCard value={velocityValue} series={velocitySeries} selectedDay={selectedDay} onSelectDay={onSelectVelocityDay} />
    </section>
  )
}
