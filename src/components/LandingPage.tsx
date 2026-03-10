import { useMemo, useRef } from 'react'
import seedData from '../data/subjects.json'
import { useAppStore } from '../stores/app.store'
import QualificationChip from './QualificationChip'

interface LandingPageProps {
  onboarded: boolean
  onGetStarted: () => void
  onContinuePlanning?: () => void
  onViewProgress?: () => void
  onEditSubjects?: () => void
  onOpenFeedback?: () => void
  nearestUserExam?: { days: number; subjectName: string; paperName: string; board: string } | null
  selectedSubjectDetails?: { name: string; board: string }[]
}

/** Build a set of offering IDs that belong to GCSE qualifications. */
const gcseOfferingIds = new Set(
  seedData.offerings
    .filter((o) => o.qualificationId === 'gcse')
    .map((o) => o.id),
)

function getCountdown() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let earliestDays: number | null = null

  for (const paper of seedData.papers) {
    if (!gcseOfferingIds.has(paper.offeringId)) continue
    const exam = new Date(paper.examDate + 'T00:00:00')
    const diff = Math.ceil((exam.getTime() - today.getTime()) / 86_400_000)
    if (diff > 0 && (earliestDays === null || diff < earliestDays)) {
      earliestDays = diff
    }
  }
  return earliestDays
}

const STORY_STEPS = [
  {
    step: 1,
    title: 'Pick your subjects',
    description: 'Select what you\'re sitting. Every paper, topic, and exam date is mapped automatically.',
  },
  {
    step: 2,
    title: 'See what matters today',
    description: 'A prioritised revision list that shifts daily based on exam dates, confidence, and coverage.',
  },
  {
    step: 3,
    title: 'Study with focus',
    description: 'Start a timed session on the right topic. Rate your confidence when you finish.',
  },
]

const SCENARIOS = [
  {
    number: 1,
    situation: '"I don\'t know where to start"',
    response: 'The app looks at every exam date, your confidence scores, and what you\'ve already covered \u2014 then gives you one clear recommendation.',
    variant: 'recommend' as const,
  },
  {
    number: 2,
    situation: '"I keep revising the same subjects"',
    response: 'Weak topics surface automatically so you can tackle them now, not the night before the exam.',
    variant: 'attention' as const,
  },
  {
    number: 3,
    situation: '"I can\'t tell if revision is working"',
    response: 'Track sessions, confidence, and momentum across every subject \u2014 so you can see progress building over time.',
    variant: 'progress' as const,
  },
]

function ScenarioPreview({ variant }: { variant: 'recommend' | 'attention' | 'progress' }) {
  if (variant === 'recommend') {
    return (
      <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-blue-800">Algebra & Functions</span>
          <span className="text-[10px] font-semibold text-blue-500">Recommended</span>
        </div>
        <p className="text-[10px] text-blue-500/70 mt-0.5">Low confidence &middot; Exam in 12 days</p>
      </div>
    )
  }

  if (variant === 'attention') {
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium text-gray-800">Organic Chemistry</span>
          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">Needs attention</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">Weak: Alkenes</span>
          <div className="flex gap-0.5">
            {[true, false, false, false, false].map((on, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-amber-400' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-1.5 flex items-center justify-between">
        <span className="text-[10px] font-medium text-emerald-700">25 min session</span>
        <span className="text-[10px] text-emerald-500">Confidence: 4/5</span>
      </div>
      <div className="flex gap-0.5">
        {[60, 40, 80, 30, 55].map((w, i) => (
          <div key={i} className="h-1 rounded-full bg-blue-200 flex-1">
            <div className="h-1 rounded-full bg-blue-500" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-500">Maths &mdash; 3 sessions</span>
        <div className="flex gap-0.5">
          {[true, true, true, false, false].map((on, i) => (
            <span key={i} className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-blue-400' : 'bg-gray-200'}`} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ScenarioPanel({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">
          Real problems, solved
        </p>
        <div className="space-y-3">
          {SCENARIOS.map((s) => (
            <div key={s.number}>
              <p className="text-sm font-semibold text-gray-900">{s.situation}</p>
              <p className="text-xs text-gray-400 leading-relaxed">{s.response}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">
        Real problems, solved
      </p>
      <div className="space-y-3">
        {SCENARIOS.map((s, i) => (
          <div
            key={s.number}
            className={`rounded-xl border p-4 ${
              i === 0
                ? 'border-blue-100 bg-blue-50/30'
                : 'border-gray-100 bg-white'
            }`}
          >
            <p className="text-sm font-semibold text-gray-900 mb-0.5">{s.situation}</p>
            <p className="text-xs text-gray-400 leading-relaxed mb-3">{s.response}</p>
            <ScenarioPreview variant={s.variant} />
          </div>
        ))}
      </div>
    </div>
  )
}

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
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-1">
        Your revision journey
      </p>
      <p className="text-sm text-gray-500 mb-5 max-w-lg">
        What the app feels like over days and weeks of use.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Setup card */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <span className="inline-block rounded-md bg-blue-50 text-blue-600 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 mb-3">Setup</span>
          <div className="space-y-1.5">
            {['Maths \u2014 AQA', 'Chemistry \u2014 OCR', 'English Lit \u2014 AQA'].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                <span className="text-xs text-gray-700">{s}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Today card */}
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
          <span className="inline-block rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 mb-3">Today's plan</span>
          <div className="space-y-1.5">
            <div className="rounded-lg bg-white border border-blue-100 px-2.5 py-1.5">
              <p className="text-xs font-medium text-blue-800">Algebra & Functions</p>
              <p className="text-[10px] text-blue-500">Low confidence &middot; exam soon</p>
            </div>
            <div className="rounded-lg bg-white/70 border border-gray-100 px-2.5 py-1.5">
              <p className="text-xs font-medium text-gray-700">Organic Chemistry</p>
              <p className="text-[10px] text-gray-400">Not covered recently</p>
            </div>
          </div>
        </div>

        {/* Progress card */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          <span className="inline-block rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 mb-3">Progress</span>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">Maths</span>
              <span className="text-[10px] text-emerald-600 font-medium">8 sessions</span>
            </div>
            <div className="flex gap-0.5">
              {[70, 45, 85, 35, 60].map((w, i) => (
                <div key={i} className="h-1.5 rounded-full bg-gray-200 flex-1">
                  <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700">Chemistry</span>
              <span className="text-[10px] text-amber-600 font-medium">3 sessions</span>
            </div>
            <div className="flex gap-0.5">
              {[30, 20, 50, 15, 25].map((w, i) => (
                <div key={i} className="h-1.5 rounded-full bg-gray-200 flex-1">
                  <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Workflow strip */}
      <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
        {['Setup', "Today's plan", 'Focus session', 'Progress'].map((label, i, arr) => (
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

function TrustSection() {
  const features = [
    {
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
        </svg>
      ),
      title: 'GCSE coverage built in, A-Level via custom setup',
      description: 'GCSE subjects, papers, and topics are pre-mapped to current exam boards. A-Level and other qualifications are supported through custom subject creation.',
    },
    {
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      ),
      title: 'Custom subjects',
      description: 'Add any subject not in the default list. Useful for less common courses or school-specific content.',
    },
    {
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25h-13.5A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25h-13.5A2.25 2.25 0 0 1 3 12V5.25" />
        </svg>
      ),
      title: 'Works offline',
      description: 'All data stays on your device. No account required. Use it anywhere, with or without internet.',
    },
    {
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
        </svg>
      ),
      title: 'Suitable for classrooms',
      description: 'No sign-up, no tracking, no ads. Teachers and schools can recommend it with confidence.',
    },
  ]

  return (
    <section className="px-5 py-12 sm:py-16 max-w-5xl mx-auto">
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600 mb-2">
          Built for trust
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-2">
          Coverage you can rely on
        </h2>
        <p className="text-sm text-gray-500 mb-8 max-w-lg">
          Whether you're a student getting started or a teacher evaluating revision tools.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((f) => (
            <div key={f.title} className="flex gap-4">
              <div className="shrink-0 mt-0.5">{f.icon}</div>
              <div>
                <p className="text-sm font-semibold text-gray-900 mb-1">{f.title}</p>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function LandingPage({
  onboarded,
  onGetStarted,
  onContinuePlanning,
  onViewProgress,
  onEditSubjects,
  onOpenFeedback,
  nearestUserExam,
  selectedSubjectDetails,
}: LandingPageProps) {
  const studyMode = useAppStore(s => s.studyMode)
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
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 mb-3">
              <span>Home</span>
              {studyMode && <span>&middot;</span>}
              {studyMode && <QualificationChip mode={studyMode} />}
            </div>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600 mb-3">
                Revision, prioritised
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 leading-tight mb-4">
                Your exams are coming. Your schedule starts now.
              </h1>
              <p className="text-base text-gray-500 leading-relaxed mb-6 max-w-md">
                Build a revision plan that adapts to your confidence, your exam dates, and what you haven't covered yet.
              </p>

              {/* Countdown card */}
              {countdown !== null && (
                <div className="inline-flex items-center gap-3 rounded-xl border border-gray-100 bg-white shadow-sm px-4 py-3 mb-8">
                  <span
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: countdown <= 30 ? '#F59E0B' : '#3B82F6' }}
                  >
                    {countdown}
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-medium text-gray-900">
                      Days until GCSE exams
                    </p>
                    <p className="text-xs text-gray-400">Summer exam season starts soon</p>
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
                  Start your revision schedule
                </button>
                <button
                  onClick={scrollToDemo}
                  className="sm:hidden px-6 py-3 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium text-sm
                             hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all duration-150"
                >
                  See how it works
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3 pl-1">No account needed &middot; Works offline</p>
            </div>

            {/* Scenario panel — desktop inline */}
            <div className="hidden sm:block mt-0">
              <ScenarioPanel />
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
          <div className="mt-3">
            <button
              onClick={onOpenFeedback}
              className="rounded-xl border border-gray-100 bg-white p-4 hover:border-gray-200 hover:shadow-sm transition cursor-pointer text-left w-full"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38a1.125 1.125 0 0 1-1.536-.41 12.012 12.012 0 0 1-1.634-4.264m5.305-5.305c.688.06 1.386.09 2.09.09h.75a4.5 4.5 0 0 1 0 9h-.75c-.704 0-1.402.03-2.09.09m0-9.18c-.253-.962-.584-1.892-.985-2.783a1.125 1.125 0 0 1 .463-1.511l.657-.38c.55-.318 1.247-.106 1.536.41a12.012 12.012 0 0 1 1.634 4.264" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-700">Share feedback</p>
                  <p className="text-xs text-gray-400">Tell us what felt confusing, useful, or broken</p>
                </div>
              </div>
            </button>
          </div>
        </section>
      )}

      {!onboarded && (
        <>
          {/* Scenario panel — mobile below hero */}
          <section className="px-5 pb-10 sm:hidden max-w-5xl mx-auto">
            <ScenarioPanel compact />
          </section>

          {/* How it works — story steps */}
          <section ref={demoRef} className="px-5 py-14 sm:py-20 max-w-5xl mx-auto">
            <div className="mb-8 sm:mb-10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-600 mb-2">
                How it works
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-2">
                Three steps to a smarter revision plan
              </h2>
              <p className="text-base text-gray-500 max-w-lg">
                Set up once. The app handles the prioritisation from there.
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

          {/* Product showcase — revision journey */}
          <section className="px-5 pb-12 sm:pb-16 max-w-5xl mx-auto">
            <ProductShowcase />
          </section>

          {/* Trust / coverage section */}
          <TrustSection />

          {/* Final CTA */}
          <section className="px-5 pb-16 max-w-5xl mx-auto text-center">
            <button
              onClick={onGetStarted}
              className="px-8 py-3.5 rounded-xl bg-blue-600 text-white font-semibold text-sm
                         hover:bg-blue-700 active:scale-[0.98] transition-all duration-150 shadow-sm"
            >
              Start your revision schedule
            </button>
          </section>
        </>
      )}
    </div>
  )
}
