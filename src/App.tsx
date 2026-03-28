import { Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import { useLocalAccountApi } from './lib/api/local/useAccountApi'
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

function App() {
  const account = useLocalAccountApi()
  const { recoveryDone, recoveredSession } = useAppBootstrap()
  const { page, navigateTo } = useAppNavigation()
  const shell = useAppShell({ recoveredSession, navigateTo })
  const assistant = useStudyAssistant()

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
        onCompleteOnboarding={shell.completeOnboarding}
        onBackToHome={shell.closeOnboarding}
        onCompleteEdit={shell.completeEditSetup}
        onCancelEdit={shell.completeEditSetup}
        onCloseSession={shell.closeSession}
        onGoToProgress={shell.goToProgress}
        onCloseSubjectPicker={shell.closeSubjectPicker}
        onStartSession={shell.startSession}
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
              onBrowseOffering={shell.startSubjectBrowse}
              onEditSubjects={shell.openEditSetup}
            />
          )}
        />
        <Route
          path="/progress"
          element={<ProgressScreen onGoToToday={shell.goToToday} />}
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
