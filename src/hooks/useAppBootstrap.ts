import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../stores/app.store'
import { useTimerStore } from '../stores/timer.store'
import { scoreSingleTopic } from '../lib/engine'
import type { ActiveSessionState } from '../types/active-session'

async function discardOrphanedTimer() {
  await useTimerStore.getState().discardPersisted()
}

async function recoverActiveSession(): Promise<ActiveSessionState | null> {
  const timerSession = useTimerStore.getState().session
  if (!timerSession) return null

  const state = useAppStore.getState()
  if (timerSession.targetType === 'topic') {
    const topic = state.topics.find((t) => t.id === timerSession.targetId)
    if (!topic) { await discardOrphanedTimer(); return null }
    const paper = state.papers.find((p) => p.id === topic.paperId)
    if (!paper) { await discardOrphanedTimer(); return null }
    const offering = state.offerings.find((o) => o.id === topic.offeringId)
    if (!offering) { await discardOrphanedTimer(); return null }
    const subject = state.subjects.find((s) => s.id === offering.subjectId)
    if (!subject) { await discardOrphanedTimer(); return null }

    const scored = scoreSingleTopic(topic, paper, offering, subject, new Date())
    return { kind: 'topic', scored, source: timerSession.source as import('../types').ScheduleSource, scheduleItemId: timerSession.scheduleItemId }
  }

  const paper = state.papers.find((candidate) => candidate.id === timerSession.targetId)
  if (!paper) { await discardOrphanedTimer(); return null }
  const offering = state.offerings.find((candidate) => candidate.id === paper.offeringId)
  if (!offering) { await discardOrphanedTimer(); return null }
  const subject = state.subjects.find((candidate) => candidate.id === offering.subjectId)
  if (!subject) { await discardOrphanedTimer(); return null }

  return {
    kind: 'paper',
    paper,
    offering,
    subject,
    source: timerSession.source as import('../types').PaperAttemptSource,
    restored: timerSession.mode === 'stopped',
  }
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
        const recovered = await recoverActiveSession()
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
