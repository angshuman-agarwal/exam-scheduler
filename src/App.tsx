import { useState, useEffect, useRef } from 'react'
import { useAppStore } from './stores/app.store'
import { useTimerStore } from './stores/timer.store'
import { scoreSingleTopic } from './lib/engine'
import Layout from './components/Layout'
import Onboarding from './components/Onboarding'
import TodayPlan from './components/TodayPlan'
import SubjectPicker from './components/SubjectPicker'
import SessionLogger from './components/SessionLogger'
import Progress from './components/Progress'
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

function App() {
  const init = useAppStore((s) => s.init)
  const initialized = useAppStore((s) => s.initialized)
  const onboarded = useAppStore((s) => s.onboarded)

  const initTimer = useTimerStore((s) => s.initTimer)

  const [page, setPage] = useState<'today' | 'progress'>('today')
  const [activeSession, setActiveSession] = useState<{
    scored: ScoredTopic
    source: ScheduleSource
    scheduleItemId?: string
  } | null>(null)
  const [activeOffering, setActiveOffering] = useState<Offering | null>(null)
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null)
  const [activePaper, setActivePaper] = useState<Paper | null>(null)
  const [editingSetup, setEditingSetup] = useState(false)
  const [recoveryDone, setRecoveryDone] = useState(false)
  const recoveryRan = useRef(false)

  useEffect(() => {
    const doInit = async () => {
      await init()
      await initTimer()
      // Recover timer session synchronously after both stores are ready
      if (!recoveryRan.current) {
        recoveryRan.current = true
        const recovered = recoverActiveSession()
        if (recovered) setActiveSession(recovered)
      }
      setRecoveryDone(true)
    }
    doInit()
  }, [init, initTimer])

  if (!initialized || !recoveryDone) {
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

  // Edit subjects mode
  if (editingSetup) {
    return (
      <Onboarding
        mode="edit"
        onComplete={() => setEditingSetup(false)}
        onCancel={() => setEditingSetup(false)}
      />
    )
  }

  // Session logger
  if (activeSession) {
    return (
      <SessionLogger
        scored={activeSession.scored}
        source={activeSession.source}
        scheduleItemId={activeSession.scheduleItemId}
        onBack={() => setActiveSession(null)}
        onGoToProgress={() => { setActiveSession(null); setPage('progress') }}
      />
    )
  }

  // Subject picker (offering-aware)
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

  return (
    <Layout currentPage={page} onNavigate={setPage}>
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
      {page === 'progress' && <Progress onGoToToday={() => setPage('today')} />}
    </Layout>
  )
}

export default App
