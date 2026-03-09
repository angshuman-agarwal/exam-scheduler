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

const STORY_STEPS = [
  {
    step: 1,
    title: 'Choose your subjects',
    description: 'Pick the subjects you\'re sitting. The app maps every paper and topic automatically.',
  },
  {
    step: 2,
    title: 'Get today\'s plan',
    description: 'A ranked revision list that shifts with exam dates, confidence, and what you\'ve already covered.',
  },
  {
    step: 3,
    title: 'Focus and study',
    description: 'Start a timed session on the topic that matters most. Rate your confidence when you finish.',
  },
]

function SetupPreview() {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {['Maths', 'Chemistry', 'English'].map((s) => (
          <span key={s} className="rounded-md bg-blue-50 border border-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{s}</span>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">AQA</span>
        <div className="flex gap-0.5">
          {[true, true, true, false, false].map((on, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-blue-400' : 'bg-gray-200'}`} />
          ))}
        </div>
        <span className="text-[10px] text-gray-400">Confidence</span>
      </div>
    </div>
  )
}

function PlanPreview() {
  const topics = [
    { name: 'Algebra & Functions', tag: 'Recommended', accent: true },
    { name: 'Organic Chemistry', tag: '12 days left', accent: false },
    { name: 'Shakespeare Analysis', tag: null, accent: false },
  ]
  return (
    <div className="space-y-1.5">
      {topics.map((t) => (
        <div key={t.name} className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${t.accent ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border border-gray-100'}`}>
          <span className={`font-medium ${t.accent ? 'text-blue-800' : 'text-gray-700'}`}>{t.name}</span>
          {t.tag && <span className={`text-[10px] font-semibold ${t.accent ? 'text-blue-500' : 'text-gray-400'}`}>{t.tag}</span>}
        </div>
      ))}
    </div>
  )
}

function SessionPreview() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">Studying</span>
        <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Active
        </span>
      </div>
      <div className="text-center py-1">
        <p className="text-2xl font-bold tabular-nums text-gray-900 tracking-tight">24:00</p>
      </div>
      <div className="rounded-lg bg-white border border-gray-100 px-2.5 py-1.5">
        <p className="text-xs font-medium text-gray-800">Algebra &amp; Functions</p>
        <p className="text-[10px] text-gray-400">Maths P1</p>
      </div>
      <div className="flex items-center justify-center gap-3">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-gray-200 bg-white">
          <svg className="w-2.5 h-2.5 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
        </span>
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-gray-200 bg-white">
          <svg className="w-2.5 h-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" /></svg>
        </span>
      </div>
      <div className="text-center">
        <span className="text-[10px] text-gray-400">Confidence check after session</span>
      </div>
    </div>
  )
}

function StoryStepCard({ step, title, description, children }: { step: number; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 flex flex-col">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 text-sm font-bold mb-4">{step}</span>
      <h3 className="text-lg font-semibold text-gray-900 mb-1.5">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed mb-5">{description}</p>
      <div className="mt-auto rounded-xl border border-gray-100 bg-gray-50/50 p-4">
        {children}
      </div>
    </div>
  )
}

function ProductShowcase() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 sm:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-4">
        Your revision journey
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Setup card */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <span className="inline-block rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 mb-3">Setup</span>
          <div className="space-y-1.5">
            {['Maths — AQA', 'Chemistry — OCR', 'English Lit — AQA'].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span className="text-xs text-gray-700">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Today card */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
          <span className="inline-block rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 mb-3">Recommended</span>
          <div className="space-y-1.5">
            <div className="rounded-lg bg-white border border-blue-100 px-2.5 py-1.5">
              <p className="text-xs font-medium text-blue-800">Algebra & Functions</p>
              <p className="text-[10px] text-blue-500">Maths P1 — 12 days</p>
            </div>
            <div className="rounded-lg bg-white/70 border border-gray-100 px-2.5 py-1.5">
              <p className="text-xs font-medium text-gray-700">Organic Chemistry</p>
              <p className="text-[10px] text-gray-400">Chem P2 — 18 days</p>
            </div>
          </div>
        </div>

        {/* Study session card */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <span className="inline-block rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 mb-3">Focus</span>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold tabular-nums text-gray-900">24:00</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Active
              </span>
            </div>
            <div className="rounded-lg bg-white border border-gray-100 px-2.5 py-1.5">
              <p className="text-xs font-medium text-gray-800">Algebra &amp; Functions</p>
              <p className="text-[10px] text-gray-400">Maths P1</p>
            </div>
            <p className="text-[10px] text-gray-400 text-center">Confidence check after session</p>
          </div>
        </div>
      </div>

      {/* Workflow strip */}
      <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
        {['Setup', "Today's plan", 'Study session', 'Progress'].map((label, i, arr) => (
          <span key={label} className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">{label}</span>
            {i < arr.length - 1 && (
              <svg className="w-3 h-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

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
                  className="sm:hidden px-6 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium text-sm
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
          <section className="px-5 pb-10 sm:hidden max-w-5xl mx-auto">
            <DemoMedia />
          </section>

          {/* How it works — story steps */}
          <section ref={demoRef} className="px-5 py-14 sm:py-20 max-w-5xl mx-auto">
            <div className="mb-8 sm:mb-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600 mb-2">
                How it works
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-2">
                From exam setup to focused study
              </h2>
              <p className="text-base text-gray-500 max-w-lg">
                Three steps to a revision plan that adapts as your exams approach.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
              {STORY_STEPS.map((s) => (
                <StoryStepCard key={s.step} step={s.step} title={s.title} description={s.description}>
                  {s.step === 1 && <SetupPreview />}
                  {s.step === 2 && <PlanPreview />}
                  {s.step === 3 && <SessionPreview />}
                </StoryStepCard>
              ))}
            </div>
          </section>

          {/* Product showcase */}
          <section className="px-5 pb-12 sm:pb-16 max-w-5xl mx-auto">
            <ProductShowcase />
          </section>

          {/* Trust strip */}
          <section className="px-5 py-6 pb-10 max-w-5xl mx-auto text-center">
            <p className="text-xs text-gray-400">
              Works offline-first &middot; Built for GCSE, A-level, and beyond
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

