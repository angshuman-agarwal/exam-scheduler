import { useMemo, useState } from 'react'
import { usePostHog } from 'posthog-js/react'
import { useAppStore } from '../stores/app.store'
import { useTimerStore } from '../stores/timer.store'
import { localSubjectsApi } from '../lib/api/local/subjects'
import type { AppPage } from '../lib/navigation'
import type { Offering, Paper, PaperAttemptSource, ScheduleSource, ScoredTopic, Subject } from '../types'
import type { ActiveSessionState } from '../types/active-session'

interface UseAppShellOptions {
  recoveredSession: ActiveSessionState | null
  navigateTo: (page: AppPage) => void
}

export interface SubjectBrowseContext {
  originPage: AppPage
  planNowTopicId?: string | null
}

export function useAppShell({ recoveredSession, navigateTo }: UseAppShellOptions) {
  const posthog = usePostHog()
  const [sessionOverride, setSessionOverride] = useState<ActiveSessionState | null>()
  const [activeOffering, setActiveOffering] = useState<Offering | null>(null)
  const [activeSubject, setActiveSubject] = useState<Subject | null>(null)
  const [activePaper, setActivePaper] = useState<Paper | null>(null)
  const [activeSubjectBrowseContext, setActiveSubjectBrowseContext] = useState<SubjectBrowseContext | null>(null)
  const [editingSetup, setEditingSetup] = useState(false)
  const [recentlySwappedTopicId, setRecentlySwappedTopicId] = useState<string | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showFeedback, setShowFeedback] = useState(false)
  const activeSession = sessionOverride === undefined ? recoveredSession : sessionOverride

  const papers = useAppStore((state) => state.papers)
  const offerings = useAppStore((state) => state.offerings)
  const subjects = useAppStore((state) => state.subjects)
  const boards = useAppStore((state) => state.boards)
  const selectedOfferingIds = useAppStore((state) => state.selectedOfferingIds)

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

  return {
    activeOffering,
    activePaper,
    activeSession,
    activeSubject,
    activeSubjectBrowseContext,
    editingSetup,
    nearestUserExam,
    recentlySwappedTopicId,
    selectedSubjectDetails,
    showFeedback,
    showOnboarding,
    clearRecentlySwappedTopic() {
      setRecentlySwappedTopicId(null)
    },
    closeFeedback() {
      setShowFeedback(false)
    },
    closeOnboarding() {
      setShowOnboarding(false)
    },
    closeSession() {
      setSessionOverride(null)
    },
    closeSubjectPicker(destination?: AppPage) {
      const nextPage = destination ?? activeSubjectBrowseContext?.originPage ?? 'today'
      setActiveOffering(null)
      setActiveSubject(null)
      setActivePaper(null)
      setActiveSubjectBrowseContext(null)
      navigateTo(nextPage)
    },
    completePlanNowSwap() {
      posthog?.capture('plan_now_swap')
      setActiveOffering(null)
      setActiveSubject(null)
      setActivePaper(null)
      setActiveSubjectBrowseContext(null)
      navigateTo('today')
    },
    completeEditSetup() {
      setEditingSetup(false)
    },
    completeOnboarding() {
      posthog?.capture('onboarding_complete')
      navigateTo('today')
    },
    goToProgress() {
      posthog?.capture('navigate_progress')
      setSessionOverride(null)
      setActiveOffering(null)
      setActiveSubject(null)
      setActivePaper(null)
      setActiveSubjectBrowseContext(null)
      navigateTo('progress')
    },
    goToToday() {
      posthog?.capture('navigate_today')
      navigateTo('today')
    },
    openEditSetup() {
      posthog?.capture('edit_subjects_open')
      setEditingSetup(true)
    },
    openFeedback() {
      posthog?.capture('feedback_open')
      setShowFeedback(true)
    },
    openOnboarding() {
      posthog?.capture('onboarding_open')
      setShowOnboarding(true)
    },
    markRecentlySwappedTopic(topicId: string | null) {
      setRecentlySwappedTopicId(topicId)
    },
    shouldShowOverlay(onboarded: boolean) {
      return (
        (!onboarded && showOnboarding)
        || editingSetup
        || activeSession !== null
        || (activeOffering !== null && activeSubject !== null)
      )
    },
    startSession(scored: ScoredTopic, source: ScheduleSource, scheduleItemId?: string) {
      posthog?.capture('session_start', { subject: scored.subject.name, topic: scored.topic.name })
      const timerSession = useTimerStore.getState().session
      if (timerSession?.mode === 'stopped' || timerSession?.mode === 'interrupted') {
        useTimerStore.getState().discard()
      }
      setSessionOverride({ kind: 'topic', scored, source, scheduleItemId })
    },
    startPaperSession(
      paper: Paper,
      offering: Offering,
      subject: Subject,
      source: PaperAttemptSource,
      options?: { selectionRequired?: boolean },
    ) {
      posthog?.capture('paper_session_start', { subject: subject.name, paper: paper.name })
      const timerSession = useTimerStore.getState().session
      if (timerSession?.mode === 'stopped' || timerSession?.mode === 'interrupted') {
        useTimerStore.getState().discard()
      }
      setSessionOverride({
        kind: 'paper',
        paper,
        offering,
        subject,
        source,
        selectionRequired: options?.selectionRequired ?? false,
      })
    },
    startSubjectBrowse(offering: Offering, subject: Subject, paper?: Paper | null, context?: SubjectBrowseContext) {
      posthog?.capture('subject_browse', { subject: subject.name, offering: offering.label })
      setActiveOffering(offering)
      setActiveSubject(subject)
      setActivePaper(paper ?? null)
      setActiveSubjectBrowseContext(context ?? { originPage: 'today' })
    },
  }
}
