import { Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import { useLocalAccountApi } from './lib/api/local/useAccountApi'
import { useLocalPlansApi } from './lib/api/local/usePlansApi'
import { getPathForPage } from './lib/navigation'
import { useAppBootstrap } from './hooks/useAppBootstrap'
import { useAppNavigation } from './hooks/useAppNavigation'
import { useAppShell } from './hooks/useAppShell'
import Layout from './components/Layout'
import HomeScreen from './screens/HomeScreen'
import TodayScreen from './screens/TodayScreen'
import ProgressScreen from './screens/ProgressScreen'
import AppOverlays from './screens/AppOverlays'
import StudyAssistantPresence from './features/study-assistant/StudyAssistantPresence'
import { useStudyAssistant } from './features/study-assistant/useStudyAssistant'
import { useAppStore } from './stores/app.store'

function App() {
  const account = useLocalAccountApi()
  const plansApi = useLocalPlansApi()
  const { recoveryDone, recoveredSession } = useAppBootstrap()
  const { page, navigateTo } = useAppNavigation()
  const shell = useAppShell({ recoveredSession, navigateTo })
  const assistant = useStudyAssistant()
  const getTopicsForOffering = useAppStore((state) => state.getTopicsForOffering)
  const selectedOfferingIds = useAppStore((state) => state.selectedOfferingIds)

  const handleProgressPlanNow = (topicId: string) => {
    const today = new Date()
    const planItems = plansApi.getPlanItems(today)
    const topicScoreMap = new Map<string, number>()

    for (const offeringId of selectedOfferingIds) {
      for (const scored of getTopicsForOffering(offeringId, today)) {
        topicScoreMap.set(scored.topic.id, scored.score)
      }
    }

    const swapCandidate = [...planItems]
      .map((item) => ({ item, score: topicScoreMap.get(item.topicId) ?? 0 }))
      .sort((a, b) => {
        if (a.item.source === 'auto' && b.item.source !== 'auto') return -1
        if (a.item.source !== 'auto' && b.item.source === 'auto') return 1
        return a.score - b.score
      })[0]

    if (planItems.length >= 4 && swapCandidate) {
      plansApi.removeFromPlan(swapCandidate.item.id)
      setTimeout(() => {
        plansApi.addToPlan(topicId, 'manual', today)
        shell.markRecentlySwappedTopic(topicId)
        shell.goToToday()
      }, 0)
      return
    }

    plansApi.addToPlan(topicId, 'manual', today)
    shell.markRecentlySwappedTopic(topicId)
    shell.goToToday()
  }

  if (!account.initialized || !recoveryDone) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  if (shell.shouldShowOverlay(account.onboarded)) {
    return (
      <AppOverlays
        onboarded={account.onboarded}
        showOnboarding={shell.showOnboarding}
        editingSetup={shell.editingSetup}
        activeSession={shell.activeSession}
        activeOffering={shell.activeOffering}
        activeSubject={shell.activeSubject}
        activePaper={shell.activePaper}
        activeSubjectBrowseContext={shell.activeSubjectBrowseContext}
        onCompleteOnboarding={shell.completeOnboarding}
        onBackToHome={shell.closeOnboarding}
        onCompleteEdit={shell.completeEditSetup}
        onCancelEdit={shell.completeEditSetup}
        onCloseSession={shell.closeSession}
        onGoToProgress={shell.goToProgress}
        onCloseSubjectPicker={shell.closeSubjectPicker}
        onCompletePlanNowSwap={shell.completePlanNowSwap}
        onBrowsePaperTopics={(offering, subject, paper) => {
          shell.closeSession()
          shell.startSubjectBrowse(offering, subject, paper, { originPage: 'today' })
        }}
        onStartSession={shell.startSession}
        onStartPaperSession={shell.startPaperSession}
      />
    )
  }

  if (!account.onboarded) {
    return <LandingPage onboarded={false} onGetStarted={shell.openOnboarding} />
  }

  // ── App shell (bottom nav visible) ──

  // Returning-user Home: full-screen front door, no bottom nav
  if (page === 'home') {
    return (
      <Layout
        assistantDocked={assistant.isEnabled && assistant.isOpen}
        currentPage={page}
        onNavigate={navigateTo}
        showMobileBottomNav={false}
      >
        <HomeScreen
          showFeedback={shell.showFeedback}
          onContinuePlanning={shell.goToToday}
          onViewProgress={shell.goToProgress}
          onEditSubjects={shell.openEditSetup}
          onOpenFeedback={shell.openFeedback}
          onCloseFeedback={shell.closeFeedback}
          nearestUserExam={shell.nearestUserExam}
          selectedSubjectDetails={shell.selectedSubjectDetails}
        />
        <StudyAssistantPresence
          assistant={assistant}
          currentPage="home"
          subjectCount={shell.selectedSubjectDetails.length}
        />
      </Layout>
    )
  }

  return (
    <Layout
      assistantDocked={assistant.isEnabled && assistant.isOpen}
      currentPage={page}
      onNavigate={navigateTo}
    >
      <Routes>
        <Route
          path="/today"
          element={(
            <TodayScreen
              onStartSession={shell.startSession}
              onStartPaperSession={shell.startPaperSession}
              onBrowseOffering={(offering, subject, paper) => shell.startSubjectBrowse(offering, subject, paper, { originPage: 'today' })}
              onEditSubjects={shell.openEditSetup}
              recentlySwappedTopicId={shell.recentlySwappedTopicId}
              onClearRecentlySwappedTopic={shell.clearRecentlySwappedTopic}
            />
          )}
        />
        <Route
          path="/progress"
          element={(
            <ProgressScreen
              onGoToToday={shell.goToToday}
              onBrowseOffering={(offering, subject, paper) => shell.startSubjectBrowse(offering, subject, paper, { originPage: 'progress' })}
              onStartPaperSession={(paper, offering, subject) => shell.startPaperSession(paper, offering, subject, 'calendar')}
              onPlanNowTopic={(_offering, _subject, topicId) => {
                handleProgressPlanNow(topicId)
              }}
            />
          )}
        />
        <Route path="*" element={<Navigate to={getPathForPage('today')} replace />} />
      </Routes>
      <StudyAssistantPresence
        assistant={assistant}
        currentPage={page}
        subjectCount={shell.selectedSubjectDetails.length}
      />
    </Layout>
  )
}

export default App
