import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import { useLocalAccountApi } from './lib/api/local/useAccountApi'
import { getPageFromPath, getPathForPage, type AppPage } from './lib/navigation'
import { useAppBootstrap } from './hooks/useAppBootstrap'
import { useAppShell } from './hooks/useAppShell'
import Layout from './components/Layout'
import HomeScreen from './screens/HomeScreen'
import TodayScreen from './screens/TodayScreen'
import ProgressScreen from './screens/ProgressScreen'
import AppOverlays from './screens/AppOverlays'

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
  const account = useLocalAccountApi()
  const { recoveryDone, recoveredSession } = useAppBootstrap()
  const { page, navigateTo } = useAppNavigation()
  const shell = useAppShell({ recoveredSession, navigateTo })

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
    )
  }

  return (
    <Layout currentPage={page} onNavigate={navigateTo}>
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
    </Layout>
  )
}

export default App
