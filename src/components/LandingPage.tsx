import { useMemo, useRef } from 'react'
import seedData from '../data/subjects.json'

interface LandingPageProps {
  onboarded: boolean
  onGetStarted: () => void
  onContinuePlanning?: () => void
  onViewProgress?: () => void
  onEditSubjects?: () => void
  nearestUserExam?: { days: number; subjectName: string; paperName: string; board: string } | null
  selectedSubjectDetails?: { name: string; board: string }[]
}

function getCountdown() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let earliest: { days: number; name: string; subject: string } | null = null

  for (const paper of seedData.papers) {
    const exam = new Date(paper.examDate + 'T00:00:00')
    const diff = Math.ceil((exam.getTime() - today.getTime()) / 86_400_000)
    if (diff > 0 && (!earliest || diff < earliest.days)) {
      const offering = seedData.offerings.find((o) => o.id === paper.offeringId)
      const subject = offering
        ? seedData.subjects.find((s) => s.id === offering.subjectId)
        : null
      earliest = {
        days: diff,
        name: `${subject?.name ?? ''} ${paper.name}`,
        subject: subject?.name ?? '',
      }
    }
  }
  return earliest
}

const VALUE_SECTIONS = [
  {
    label: 'Build your setup',
    title: 'Pick your subjects and exam boards',
    description:
      'Choose the subjects you\'re sitting, and the app maps every paper and topic for you. No blank spreadsheets, no guesswork.',
    icon: (
      <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
  },
  {
    label: 'Get a plan that shifts with exam dates',
    title: 'Revision that knows what\'s urgent',
    description:
      'The planner weighs exam proximity, your confidence, and what you\'ve already covered. As dates get closer, it shifts focus automatically.',
    icon: (
      <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
    ),
  },
  {
    label: 'Track progress without losing momentum',
    title: 'See where you stand at a glance',
    description:
      'Log sessions, rate your confidence, and watch coverage build across every paper. No surprises on exam day.',
    icon: (
      <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
      </svg>
    ),
  },
]

export default function LandingPage({
  onboarded,
  onGetStarted,
  onContinuePlanning,
  onViewProgress,
  onEditSubjects,
  nearestUserExam,
  selectedSubjectDetails,
}: LandingPageProps) {
  const countdown = useMemo(() => getCountdown(), [])
  const demoRef = useRef<HTMLDivElement>(null)

  const scrollToDemo = () => {
    demoRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const details = selectedSubjectDetails ?? []

  // Tone chip logic (returning user)
  const toneChip = nearestUserExam
    ? nearestUserExam.days < 14
      ? { label: 'Final stretch', bg: 'bg-orange-100', text: 'text-orange-700' }
      : nearestUserExam.days <= 60
        ? { label: 'Getting close', bg: 'bg-amber-100', text: 'text-amber-700' }
        : { label: 'On track', bg: 'bg-blue-50', text: 'text-blue-600' }
    : null

  const stripGradient = nearestUserExam
    ? nearestUserExam.days < 14
      ? 'bg-gradient-to-r from-orange-50 to-amber-50'
      : nearestUserExam.days <= 60
        ? 'bg-gradient-to-r from-amber-50 to-orange-50'
        : 'bg-gradient-to-r from-blue-50 to-sky-50'
    : ''

  // Subject chips: show up to 4, then +N more
  const visibleChips = details.slice(0, 4)
  const overflowCount = details.length - visibleChips.length

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#faf9f7' }}>
      {/* Hero */}
      <section className="px-5 pt-14 pb-10 sm:pt-20 sm:pb-16 max-w-5xl mx-auto">
        {onboarded ? (
          /* Returning user hero */
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">
              Home
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-5">
              Ready for today's revision?
            </h1>

            {/* Exam summary strip */}
            {nearestUserExam ? (
              <div className={`flex items-center gap-4 rounded-xl ${stripGradient} px-4 py-3 mb-6`}>
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                </svg>
                <div className="leading-tight min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {nearestUserExam.subjectName} {nearestUserExam.paperName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {nearestUserExam.board} &middot; {nearestUserExam.days} days
                  </p>
                </div>
                {toneChip && (
                  <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full ${toneChip.bg} ${toneChip.text}`}>
                    {toneChip.label}
                  </span>
                )}
              </div>
            ) : (
              <div className="rounded-xl bg-gray-50 px-4 py-3 mb-6">
                <p className="text-sm text-gray-400">No upcoming exams in your current setup</p>
              </div>
            )}

            {/* Your subjects */}
            <div className="mb-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-2.5">
                Your subjects
              </p>
              {details.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {visibleChips.map((d) => (
                    <div
                      key={`${d.name}-${d.board}`}
                      className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-1.5"
                    >
                      <span className="text-sm font-medium text-gray-900">{d.name}</span>
                      <span className="text-xs text-gray-400 ml-1.5">{d.board}</span>
                    </div>
                  ))}
                  {overflowCount > 0 && (
                    <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-1.5">
                      <span className="text-sm text-gray-400">+{overflowCount} more</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No subjects selected yet.</p>
              )}
            </div>

            {/* Action row */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={onContinuePlanning}
                className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm
                           hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 shadow-sm"
              >
                Open today's plan
              </button>
              <button
                onClick={onViewProgress}
                className="px-6 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium text-sm
                           hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all duration-150"
              >
                View progress
              </button>
            </div>
          </div>
        ) : (
          /* New user marketing hero */
          <div className="sm:grid sm:grid-cols-2 sm:gap-12 sm:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">
                Exam planning that adapts to what matters next
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4">
                Know what to revise next, before exams pile up
              </h1>
              <p className="text-base text-gray-500 leading-relaxed mb-6 max-w-md">
                A revision planner that watches your exam dates, tracks your confidence, and tells you exactly where to focus — so nothing gets missed.
              </p>

              {/* Countdown card */}
              {countdown && (
                <div className="inline-flex items-center gap-3 rounded-xl border border-gray-100 bg-white shadow-sm px-4 py-3 mb-8">
                  <span
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: countdown.days <= 30 ? '#F59E0B' : '#3B82F6' }}
                  >
                    {countdown.days}
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-medium text-gray-900">
                      days until first exam
                    </p>
                    <p className="text-xs text-gray-400">{countdown.name}</p>
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={onGetStarted}
                  className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm
                             hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 shadow-sm"
                >
                  Build your exam setup
                </button>
                <button
                  onClick={scrollToDemo}
                  className="px-6 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium text-sm
                             hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all duration-150"
                >
                  See how it works
                </button>
              </div>
            </div>

            {/* Demo video — desktop inline */}
            <div className="hidden sm:block mt-0">
              <DemoMedia />
            </div>
          </div>
        )}
      </section>

      {/* Quick-link cards — returning users only */}
      {onboarded && (
        <section className="px-5 pb-10 max-w-5xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={onContinuePlanning}
              className="rounded-xl border border-gray-100 bg-white p-4 hover:border-gray-200 hover:shadow-sm transition cursor-pointer text-left"
            >
              <svg className="w-6 h-6 text-blue-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
              </svg>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">Today's plan</p>
              <p className="text-xs text-gray-500">Pick up where you left off</p>
            </button>
            <button
              onClick={onViewProgress}
              className="rounded-xl border border-gray-100 bg-white p-4 hover:border-gray-200 hover:shadow-sm transition cursor-pointer text-left"
            >
              <svg className="w-6 h-6 text-blue-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
              </svg>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">Progress</p>
              <p className="text-xs text-gray-500">See how your revision is building</p>
            </button>
            <button
              onClick={onEditSubjects}
              className="rounded-xl border border-gray-100 bg-white p-4 hover:border-gray-200 hover:shadow-sm transition cursor-pointer text-left"
            >
              <svg className="w-6 h-6 text-blue-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
              </svg>
              <p className="text-sm font-semibold text-gray-900 mb-0.5">Edit setup</p>
              <p className="text-xs text-gray-500">Add or change subjects</p>
            </button>
          </div>
        </section>
      )}

      {!onboarded && (
        <>
          {/* Demo video — mobile below hero */}
          <section ref={demoRef} className="px-5 pb-10 sm:hidden max-w-5xl mx-auto">
            <DemoMedia />
          </section>

          {/* Value sections */}
          <section className="px-5 py-12 sm:py-16 max-w-5xl mx-auto">
            <div className="sm:grid sm:grid-cols-3 sm:gap-8 space-y-6 sm:space-y-0">
              {VALUE_SECTIONS.map((section) => (
                <div
                  key={section.label}
                  className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5"
                >
                  <div className="mb-3">{section.icon}</div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-1">
                    {section.label}
                  </p>
                  <h3 className="text-base font-semibold text-gray-900 mb-2">
                    {section.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {section.description}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Trust strip */}
          <section className="px-5 py-8 pb-12 max-w-5xl mx-auto text-center">
            <p className="text-xs text-gray-400 mb-1">
              Works offline-first
            </p>
            <p className="text-xs text-gray-400">
              Built for GCSE, A-level, and beyond
            </p>
          </section>
        </>
      )}
    </div>
  )
}

/* Demo media */

function DemoMedia() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
      <video
        className="w-full"
        autoPlay
        loop
        muted
        playsInline
        poster="/demo-poster.png"
        onError={(e) => {
          const el = e.currentTarget
          if (el.parentElement) {
            el.style.display = 'none'
            el.parentElement.classList.add('demo-fallback')
          }
        }}
      >
        <source src="/demo.mp4" type="video/mp4" />
        <source src="/demo.webm" type="video/webm" />
      </video>
      <style>{`
        .demo-fallback {
          aspect-ratio: 16/9;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
        }
        .demo-fallback::after {
          content: 'Product demo coming soon';
          color: #94a3b8;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  )
}

