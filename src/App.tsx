import { useState, useEffect } from 'react'
import { useAppStore } from './stores/app.store'
import Layout from './components/Layout'
import Onboarding from './components/Onboarding'
import TodayPlan from './components/TodayPlan'
import SubjectPicker from './components/SubjectPicker'
import SessionLogger from './components/SessionLogger'
import Progress from './components/Progress'
import type { ScoredTopic, Subject, Paper, ScheduleSource } from './types'

function App() {
  const init = useAppStore((s) => s.init)
  const initialized = useAppStore((s) => s.initialized)
  const onboarded = useAppStore((s) => s.onboarded)

  const [page, setPage] = useState<'today' | 'progress'>('today')
  const [activeSession, setActiveSession] = useState<{
    scored: ScoredTopic
    source: ScheduleSource
    scheduleItemId?: string
  } | null>(null)
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null)
  const [activePaper, setActivePaper] = useState<Paper | null>(null)

  useEffect(() => {
    init()
  }, [init])

  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    )
  }

  // Onboarding gate
  if (!onboarded) {
    return <Onboarding onComplete={() => {}} />
  }

  // Session logger
  if (activeSession) {
    return (
      <SessionLogger
        scored={activeSession.scored}
        source={activeSession.source}
        scheduleItemId={activeSession.scheduleItemId}
        onBack={() => setActiveSession(null)}
      />
    )
  }

  // Subject picker
  if (activeSubject) {
    return (
      <SubjectPicker
        subject={activeSubject}
        paper={activePaper}
        onBack={() => { setActiveSubject(null); setActivePaper(null) }}
        onStartSession={(scored, source, scheduleItemId) => {
          setActiveSession({ scored, source, scheduleItemId })
        }}
      />
    )
  }

  return (
    <Layout currentPage={page} onNavigate={setPage}>
      {page === 'today' && (
        <TodayPlan
          onStartSession={(scored, source, scheduleItemId) =>
            setActiveSession({ scored, source, scheduleItemId })
          }
          onBrowseSubject={(subject, paper) => {
            setActiveSubject(subject)
            setActivePaper(paper ?? null)
          }}
        />
      )}
      {page === 'progress' && <Progress />}
    </Layout>
  )
}

export default App
