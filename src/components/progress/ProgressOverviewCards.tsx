import { recencyLabel, type LastSessionSummary } from './analytics'

// Apple-like card: pure white, precise shadow stack, full opacity
function cardClassName() {
  return [
    'h-[11rem]',
    'rounded-[1.4rem]',
    'border border-black/[0.055]',
    'bg-white',
    'p-5',
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
    <article data-testid="progress-daily-streak-card" className={cardClassName()}>
      <div className="flex items-start justify-between">
        <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#fff0e0] text-[#ff6b00]">
          <svg className="h-[1.05rem] w-[1.05rem]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12.6 2.5c.3 2-.7 3.2-1.7 4.4-.9 1.1-1.8 2.2-1.8 3.8 0 1.3.8 2.3 2.1 2.3 1.5 0 2.3-1.2 2.3-2.8 0-.8-.2-1.5-.6-2.3 2.6 1.2 4.4 3.8 4.4 6.8 0 4-2.9 6.8-7 6.8S3 18.4 3 14.5c0-3.8 2.2-6.3 4.5-8.5 1.9-1.8 3.9-3.7 5.1-3.5Z" />
          </svg>
        </div>
        <span className="text-[11px] font-semibold text-[#ff6b00]">{deltaText}</span>
      </div>

      <p className="mt-3.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Daily Streak</p>
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
        <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#e8f0ff] text-[#007AFF]">
          <svg className="h-[1.05rem] w-[1.05rem]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="12" cy="12" r="7.5" />
            <path d="M12 8v4l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-[11px] font-semibold text-[#007AFF]">
          {summary.session ? recencyLabel(summary.session.date, today) : 'No session yet'}
        </span>
      </div>

      <p className="mt-3.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Last Session</p>
      {summary.session && summary.topic && summary.subject ? (
        <>
          <div className="mt-0.5 flex items-baseline gap-0.5">
            <strong className="text-[2.6rem] font-bold leading-none tracking-[-0.04em] text-gray-900">
              {Math.round(summary.session.score * 100)}
            </strong>
            <span className="text-[13px] font-medium text-gray-400">%</span>
          </div>
          <p className="mt-auto line-clamp-1 pt-2 text-[12px] leading-5 text-gray-500">
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
  trendBars,
}: {
  value: string
  trendBars: number[]
}) {
  return (
    <article data-testid="progress-study-velocity-card" className={cardClassName()}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-gray-400">Study Velocity</p>
      <div className="mt-3 flex flex-1 items-end gap-[5px]">
        {trendBars.map((bar, index) => {
          const active = index === trendBars.length - 1
          return (
            <span
              key={index}
              data-testid="progress-velocity-bar"
              className={`block flex-1 rounded-[5px] ${active ? 'bg-[#007AFF]' : 'bg-[#007AFF]/[0.14]'}`}
              style={{ height: `${Math.max(bar, 5)}%`, minHeight: '4px' }}
            />
          )
        })}
      </div>
      <p data-testid="progress-velocity-value" className="mt-3 text-[12px] font-medium text-gray-500">
        <strong className="font-bold text-[#007AFF]">{value}</strong> vs last week
      </p>
    </article>
  )
}

export function ProgressCardsRow({
  streak,
  streakDeltaText,
  lastSession,
  today,
  velocityValue,
  velocityBars,
}: {
  streak: number
  streakDeltaText: string
  lastSession: LastSessionSummary
  today: Date
  velocityValue: string
  velocityBars: number[]
}) {
  return (
    <section className="grid grid-cols-2 items-start gap-3 lg:grid-cols-3">
      <DailyStreakCard streak={streak} deltaText={streakDeltaText} />
      <LastSessionCard summary={lastSession} today={today} />
      <StudyVelocityCard value={velocityValue} trendBars={velocityBars} />
    </section>
  )
}
