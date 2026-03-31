import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../stores/app.store'
import { useTimerStore } from '../stores/timer.store'
import { scoreSingleTopic } from '../lib/engine'
import type { ScheduleSource, ScoredTopic } from '../types'

interface ActiveSessionState {
  scored: ScoredTopic
  source: ScheduleSource
  scheduleItemId?: string
}

function recoverActiveSession(): ActiveSessionState | null {
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

export function useAppBootstrap() {
  const init = useAppStore((state) => state.init)
  const initTimer = useTimerStore((state) => state.initTimer)
  const [recoveryDone, setRecoveryDone] = useState(false)
  const [recoveredSession, setRecoveredSession] = useState<ActiveSessionState | null>(null)
  const recoveryRan = useRef(false)

  useEffect(() => {
    const doInit = async () => {
      await init()
      await initTimer()

      if (!recoveryRan.current) {
        recoveryRan.current = true
        const recovered = recoverActiveSession()
        if (recovered) {
          setRecoveredSession(recovered)
        }
      }

      setRecoveryDone(true)
    }

    void doInit()
  }, [init, initTimer])

  return {
    recoveryDone,
    recoveredSession,
  }
}
