import { useState, useEffect, useRef } from 'react'
import LandingPage from './components/LandingPage'
import FeedbackSheet from './components/FeedbackSheet'
import { useAppStore } from './stores/app.store'
import { useTimerStore } from './stores/timer.store'
import { scoreSingleTopic } from './lib/engine'
import Layout from './components/Layout'
import Onboarding from './components/Onboarding'
import TodayPlan from './components/TodayPlan'
import SubjectPicker from './components/SubjectPicker'
import SessionLogger from './components/SessionLogger'
import Progress from './components/Progress'
import PublicSeoPage from './components/PublicSeoPage'
import { getPublicPageByPath } from './lib/publicPages'
import type { ScoredTopic, Offering, Subject, Paper, ScheduleSource } from './types'

const PAGES = ['home', 'today', 'progress'] as const
type Page = (typeof PAGES)[number]

function isPageHash(value: string): value is Page {
  return (PAGES as readonly string[]).includes(value)
}

function getPageFromHash(): Page {
  const h = window.location.hash.slice(1)
  return isPageHash(h) ? h : 'home'
}

function shouldShowOnboardingFromHash() {
  return window.location.hash.slice(1) === 'onboarding'
}

function recoverActiveSession(): { scored: ScoredTopic; source: ScheduleSource; scheduleItemId?: string } | null {
  const timerSession = useTimerStore.getState().session
  if (!timerSession) return null

  const state = useAppStore.getState()
  const topic = state.topics.find((t) => t.id === timerSession.topicId)
  if (!topic) { useTimerStore.getState().discard(); return null }
  const paper = state.papers.find((p) => p.id === topic.paperId)
  if (!paper) { useTimerStore.getState().discard(); return null }
  const offering = state.offerings.find((o) => o.id === topic.offeringId)
  if (!offering) { useTimerStore.getState().discard(); return null }
  const subject = state.subjects.find((s) => s.id === offering.subjectId)
  if (!subject) { useTimerStore.getState().discard(); return null }

  const scored = scoreSingleTopic(topic, paper, offering, subject, new Date())
  return { scored, source: timerSession.source, scheduleItemId: timerSession.scheduleItemId }
}

function App() {
  const publicPage = getPublicPageByPath(window.location.pathname)
  const init = useAppStore((s) => s.init)
  const initialized = useAppStore((s) => s.initialized)
  const onboarded = useAppStore((s) => s.onboarded)

  const initTimer = useTimerStore((s) => s.initTimer)

  const [page, setPage] = useState<Page>(getPageFromHash)
  const [activeSession, setActiveSession] = useState<{
    scored: ScoredTopic
    source: ScheduleSource
    scheduleItemId?: string
  } | null>(null)
  const [activeOffering, setActiveOffering] = useState<Offering | null>(null)
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null)
  const [activePaper, setActivePaper] = useState<Paper | null>(null)
  const [editingSetup, setEditingSetup] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(shouldShowOnboardingFromHash)
  const [showFeedback, setShowFeedback] = useState(false)
  const [recoveryDone, setRecoveryDone] = useState(false)
  const recoveryRan = useRef(false)

  function navigateTo(p: Page) {
    // Same-hash guard: no hashchange fires, so sync state directly as a
    // defensive recovery in case React state drifted from the URL.
    if (window.location.hash === '#' + p) {
      setPage(p)
      return
    }
    // URL-driven: setting hash fires hashchange, whose listener calls setPage.
    window.location.hash = '#' + p
  }

  useEffect(() => {
    if (publicPage) return
    const hash = window.location.hash.slice(1)
    if (hash !== 'onboarding' && !isPageHash(hash)) {
      window.history.replaceState(null, '', '#home')
    }
    const onHashChange = () => {
      setShowOnboarding(shouldShowOnboardingFromHash())
      setPage(getPageFromHash())
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [publicPage])

  const papers = useAppStore((s) => s.papers)
  const offerings = useAppStore((s) => s.offerings)
  const subjects = useAppStore((s) => s.subjects)
  const boards = useAppStore((s) => s.boards)
  const selectedOfferingIds = useAppStore((s) => s.selectedOfferingIds)

  useEffect(() => {
    const doInit = async () => {
      await init()
      await initTimer()
      // Recover timer session synchronously after both stores are ready
      if (!recoveryRan.current) {
        recoveryRan.current = true
        const recovered = recoverActiveSession()
        if (recovered) {
          setActiveSession(recovered)
        }
      }
      setRecoveryDone(true)
    }
    doInit()
  }, [init, initTimer])

  function openOnboarding() {
    const url = new URL(window.location.href)
    url.pathname = '/'
    url.search = ''
    url.hash = 'onboarding'
    window.location.assign(url.toString())
  }

  function closeOnboarding() {
    window.location.hash = 'home'
    setShowOnboarding(false)
  }

  if (publicPage) {
    return <PublicSeoPage page={publicPage} />
  }

  if (!initialized || !recoveryDone) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  // ── Pre-app surfaces (no bottom nav) ──

  // Non-onboarded: marketing landing or initial onboarding
  if (!onboarded) {
    if (showOnboarding) {
      return (
        <Onboarding
          onComplete={() => navigateTo('today')}
          onBackToHome={closeOnboarding}
        />
      )
    }
    return <LandingPage onboarded={false} onGetStarted={openOnboarding} />
  }

  // Edit subjects mode (full-screen, no bottom nav)
  if (editingSetup) {
    return (
      <Onboarding
        mode="edit"
        onComplete={() => setEditingSetup(false)}
        onCancel={() => setEditingSetup(false)}
      />
    )
  }

  // Session logger (full-screen, bypasses everything including Home)
  if (activeSession) {
    return (
      <SessionLogger
        scored={activeSession.scored}
        source={activeSession.source}
        scheduleItemId={activeSession.scheduleItemId}
        onBack={() => setActiveSession(null)}
        onGoToProgress={() => { setActiveSession(null); navigateTo('progress') }}
      />
    )
  }

  // Subject picker (full-screen)
  if (activeOffering && activeSubject) {
    return (
      <SubjectPicker
        offering={activeOffering}
        subject={activeSubject}
        paper={activePaper}
        onBack={() => { setActiveOffering(null); setActiveSubject(null); setActivePaper(null) }}
        onStartSession={(scored, source, scheduleItemId) => {
          setActiveSession({ scored, source, scheduleItemId })
        }}
      />
    )
  }

  // ── App shell (bottom nav visible) ──

  // Compute returning-user data for app Home
  const selectedIds = new Set(selectedOfferingIds)

  const nearestUserExam = (() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let nearest: { days: number; subjectName: string; paperName: string; board: string } | null = null
    for (const p of papers) {
      if (!selectedIds.has(p.offeringId)) continue
      const exam = new Date(p.examDate + 'T00:00:00')
      const diff = Math.ceil((exam.getTime() - today.getTime()) / 86_400_000)
      if (diff > 0 && (!nearest || diff < nearest.days)) {
        const offering = offerings.find((o) => o.id === p.offeringId)
        const subject = offering ? subjects.find((s) => s.id === offering.subjectId) : null
        const board = offering ? boards.find((b) => b.id === offering.boardId) : null
        nearest = { days: diff, subjectName: subject?.name ?? '', paperName: p.name, board: board?.name ?? '' }
      }
    }
    return nearest
  })()

  // Build deduplicated selected subject details
  const selectedSubjectDetails = (() => {
    const seen = new Set<string>()
    const result: { name: string; board: string }[] = []
    for (const oid of selectedOfferingIds) {
      const offering = offerings.find((o) => o.id === oid)
      if (!offering) continue
      const key = `${offering.subjectId}|${offering.boardId}`
      if (seen.has(key)) continue
      seen.add(key)
      const subject = subjects.find((s) => s.id === offering.subjectId)
      const board = boards.find((b) => b.id === offering.boardId)
      if (subject && board) result.push({ name: subject.name, board: board.name })
    }
    result.sort((a, b) => a.name.localeCompare(b.name))
    return result
  })()

  // Returning-user Home: full-screen front door, no bottom nav
  if (page === 'home') {
    return (
      <>
        <LandingPage
          onboarded={true}
          onGetStarted={() => {}}
          onContinuePlanning={() => navigateTo('today')}
          onViewProgress={() => navigateTo('progress')}
          onEditSubjects={() => setEditingSetup(true)}
          onOpenFeedback={() => setShowFeedback(true)}
          nearestUserExam={nearestUserExam}
          selectedSubjectDetails={selectedSubjectDetails}
        />
        {showFeedback && <FeedbackSheet onClose={() => setShowFeedback(false)} />}
      </>
    )
  }

  return (
    <Layout currentPage={page} onNavigate={navigateTo}>
      {page === 'today' && (
        <TodayPlan
          onStartSession={(scored, source, scheduleItemId) =>
            setActiveSession({ scored, source, scheduleItemId })
          }
          onBrowseOffering={(offering, subject, paper) => {
            setActiveOffering(offering)
            setActiveSubject(subject)
            setActivePaper(paper ?? null)
          }}
          onEditSubjects={() => setEditingSetup(true)}
        />
      )}
      {page === 'progress' && <Progress onGoToToday={() => navigateTo('today')} />}
    </Layout>
  )
}

export default App

