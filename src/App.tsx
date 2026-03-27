import { useState, useEffect, useMemo, useRef } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import { useAppStore } from './stores/app.store'
import { useTimerStore } from './stores/timer.store'
import { scoreSingleTopic } from './lib/engine'
import { useLocalAccountApi } from './lib/api/local/useAccountApi'
import { localSubjectsApi } from './lib/api/local/subjects'
import { getPageFromPath, getPathForPage, type AppPage } from './lib/navigation'
import Layout from './components/Layout'
import Onboarding from './components/Onboarding'
import SubjectPicker from './components/SubjectPicker'
import SessionLogger from './components/SessionLogger'
import HomeScreen from './screens/HomeScreen'
import TodayScreen from './screens/TodayScreen'
import ProgressScreen from './screens/ProgressScreen'
import type { ScoredTopic, Offering, Subject, Paper, ScheduleSource } from './types'

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

function useAppNavigation() {
  const location = useLocation()
  const navigate = useNavigate()
  const page = getPageFromPath(location.pathname)

  useEffect(() => {
    if (location.pathname === '/' || getPathForPage(page) !== location.pathname) {
      navigate(getPathForPage(page), { replace: true })
    }
  }, [location.pathname, navigate, page])

  return {
    page,
    navigateTo(nextPage: AppPage) {
      navigate(getPathForPage(nextPage))
    },
  }
}

function App() {
  const init = useAppStore((s) => s.init)
  const account = useLocalAccountApi()

  const initTimer = useTimerStore((s) => s.initTimer)

  const { page, navigateTo } = useAppNavigation()
  const [activeSession, setActiveSession] = useState<{
    scored: ScoredTopic
    source: ScheduleSource
    scheduleItemId?: string
  } | null>(null)
  const [activeOffering, setActiveOffering] = useState<Offering | null>(null)
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null)
  const [activePaper, setActivePaper] = useState<Paper | null>(null)
  const [editingSetup, setEditingSetup] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const [recoveryDone, setRecoveryDone] = useState(false)
  const recoveryRan = useRef(false)

  const papers = useAppStore((s) => s.papers)
  const offerings = useAppStore((s) => s.offerings)
  const subjects = useAppStore((s) => s.subjects)
  const boards = useAppStore((s) => s.boards)
  const selectedOfferingIds = useAppStore((s) => s.selectedOfferingIds)
  const nearestUserExam = useMemo(
    () =>
      localSubjectsApi.getNearestExamSummary({
        papers,
        offerings,
        subjects,
        boards,
        selectedOfferingIds,
        today: new Date(),
      }),
    [boards, offerings, papers, selectedOfferingIds, subjects],
  )

  const selectedSubjectDetails = useMemo(
    () =>
      localSubjectsApi.getSelectedSubjectSummaries({
        offerings,
        subjects,
        boards,
        selectedOfferingIds,
      }),
    [boards, offerings, selectedOfferingIds, subjects],
  )

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

  if (!account.initialized || !recoveryDone) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  // ── Pre-app surfaces (no bottom nav) ──

  // Non-onboarded: marketing landing or initial onboarding
  if (!account.onboarded) {
    if (showOnboarding) {
      return (
        <Onboarding
          onComplete={() => navigateTo('today')}
          onBackToHome={() => setShowOnboarding(false)}
        />
      )
    }
    return <LandingPage onboarded={false} onGetStarted={() => setShowOnboarding(true)} />
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

  // Returning-user Home: full-screen front door, no bottom nav
  if (page === 'home') {
    return (
      <HomeScreen
        showFeedback={showFeedback}
        onContinuePlanning={() => navigateTo('today')}
        onViewProgress={() => navigateTo('progress')}
        onEditSubjects={() => setEditingSetup(true)}
        onOpenFeedback={() => setShowFeedback(true)}
        onCloseFeedback={() => setShowFeedback(false)}
        nearestUserExam={nearestUserExam}
        selectedSubjectDetails={selectedSubjectDetails}
      />
    )
  }

  return (
    <Layout currentPage={page} onNavigate={navigateTo}>
      <Routes>
        <Route
          path="/today"
          element={(
            <TodayScreen
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
        />
        <Route
          path="/progress"
          element={<ProgressScreen onGoToToday={() => navigateTo('today')} />}
        />
        <Route path="*" element={<Navigate to={getPathForPage('today')} replace />} />
      </Routes>
    </Layout>
  )
}

export default App
