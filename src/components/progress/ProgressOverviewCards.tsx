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

export function LastSessionCard({
  summary,
  today,
}: {
  summary: LastSessionSummary
  today: Date
}) {
  return (
    <article data-testid="progress-last-session-card" className={cardClassName()}>
      <div className="flex items-start justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[linear-gradient(180deg,#eef5ff_0%,#dfeaff_100%)] text-[#1b74ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.96),0_10px_22px_rgba(27,116,255,0.12)]">
          <svg className="h-[1.3rem] w-[1.3rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <circle cx="12" cy="13" r="6.75" />
            <path d="M12 3.75v2.5" strokeLinecap="round" />
            <path d="M9.5 3.75h5" strokeLinecap="round" />
            <path d="M12 13V9.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 13l2.55 1.55" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-[11px] font-semibold text-[#007AFF]">
          {summary.session ? recencyLabel(summary.session.date, today) : 'No session yet'}
        </span>
      </div>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Last Session</p>
      {summary.session && summary.topic && summary.subject ? (
        <>
          <div className="mt-0.5 flex items-baseline gap-0.5">
            <strong className="text-[2.6rem] font-bold leading-none tracking-[-0.04em] text-gray-900">
              {Math.round(summary.session.score * 100)}
            </strong>
            <span className="text-[13px] font-medium text-gray-400">%</span>
          </div>
          <p className="mt-auto line-clamp-2 pt-2 text-[12px] leading-5 text-gray-500">
            {summary.subject.name}: {summary.topic.name}
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
  const maxValue = Math.max(...series.points.map((point) => point.value), 0)
  const midValue = maxValue > 0 ? Math.round((maxValue / 2) * 10) / 10 : 0
  const activePointCount = series.points.filter((point) => point.value > 0).length

  return (
    <article data-testid="progress-study-velocity-card" className={`${cardClassName()} col-span-2 lg:col-span-1 lg:h-[15rem]`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Study Velocity</p>
          <p className="mt-1 text-[11px] font-medium text-gray-500">{series.unitLabel}</p>
          <p className="mt-1 text-[10px] font-medium text-[#1f63d8] sm:text-[11px]">Tap a day to filter Topic Mastery</p>
        </div>
        <div className="text-right">
          <p data-testid="progress-velocity-value" className="text-[12px] font-medium text-gray-500">
            <strong className="font-bold text-[#007AFF]">{value}</strong> vs last week
          </p>
          {selectedDay && (
            <p className="mt-1 text-[11px] font-medium text-gray-400">
              {new Date(`${selectedDay}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5 grid flex-1 grid-cols-[2rem_minmax(0,1fr)] gap-2 sm:grid-cols-[2.15rem_minmax(0,1fr)]">
        <div className="flex flex-col justify-between pb-7 text-[10px] font-medium text-gray-400">
          <span>{maxValue > 0 ? maxValue : 0}</span>
          <span>{midValue > 0 ? midValue : ''}</span>
          <span>0</span>
        </div>
        <div className="grid min-w-0 grid-cols-14 gap-1.5 sm:gap-1">
          {series.points.map((point, index) => {
            const isSelected = selectedDay === point.dateKey
            const isClickable = point.value > 0
            const isCurrentWeek = index >= series.points.length / 2
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
                aria-pressed={isSelected}
                onClick={() => isClickable && onSelectDay(point.dateKey)}
                disabled={!isClickable}
                className={`group flex min-w-0 flex-col justify-end rounded-[12px] px-[2px] pb-0.5 pt-1.5 text-center outline-none transition-all ${
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
                      })}: ${point.value} ${series.unitLabel.toLowerCase()}${
                        point.segments.length > 0
                          ? ` • ${point.segments.map((segment) => `${segment.subjectName} ${segment.value}`).join(', ')}`
                          : ''
                      }`
                    : undefined
                }
              >
                <span
                  className={`block w-full overflow-hidden rounded-[7px_7px_3px_3px] transition-all ${
                    isSelected
                      ? 'ring-2 ring-inset ring-[#007AFF] shadow-[0_12px_24px_rgba(0,122,255,0.26)]'
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
                <span
                  className={`mt-2 text-[9px] font-semibold ${
                    isSelected ? 'text-[#007AFF]' : isClickable || isOnlyActivePoint ? 'text-gray-600' : 'text-gray-400'
                  }`}
                >
                  {point.shortLabel}
                </span>
                <span className={`mt-0.5 text-[9px] ${isSelected ? 'text-[#007AFF]/70' : isClickable ? 'text-gray-500' : 'text-gray-300'}`}>
                  {point.dayNumber}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] font-medium text-gray-400">
        <span>Last Week</span>
        <span>This Week</span>
      </div>
    </article>
  )
}

export function ProgressCardsRow({
  streak,
  streakDeltaText,
  lastSession,
  today,
  velocityValue,
  velocitySeries,
  selectedDay,
  onSelectVelocityDay,
}: {
  streak: number
  streakDeltaText: string
  lastSession: LastSessionSummary
  today: Date
  velocityValue: string
  velocitySeries: StudyVelocitySeries
  selectedDay: string | null
  onSelectVelocityDay: (dateKey: string) => void
}) {
  return (
    <section className="grid grid-cols-2 items-stretch gap-2.5 sm:gap-3 lg:grid-cols-3">
      <DailyStreakCard streak={streak} deltaText={streakDeltaText} />
      <LastSessionCard summary={lastSession} today={today} />
      <StudyVelocityCard value={velocityValue} series={velocitySeries} selectedDay={selectedDay} onSelectDay={onSelectVelocityDay} />
    </section>
  )
}
