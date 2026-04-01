import Onboarding from '../components/Onboarding'
import SubjectPicker from '../components/SubjectPicker'
import SessionLogger from '../components/SessionLogger'
import PaperSessionLogger from '../components/PaperSessionLogger'
import type { SubjectBrowseContext } from '../hooks/useAppShell'
import type { Offering, Paper, PaperAttemptSource, ScheduleSource, ScoredTopic, Subject } from '../types'
import type { ActiveSessionState } from '../types/active-session'

interface AppOverlaysProps {
  onboarded: boolean
  showOnboarding: boolean
  editingSetup: boolean
  activeSession: ActiveSessionState | null
  activeOffering: Offering | null
  activeSubject: Subject | null
  activePaper: Paper | null
  activeSubjectBrowseContext: SubjectBrowseContext | null
  onCompleteOnboarding: () => void
  onBackToHome: () => void
  onCompleteEdit: () => void
  onCancelEdit: () => void
  onCloseSession: () => void
  onGoToProgress: () => void
  onCloseSubjectPicker: () => void
  onCompletePlanNowSwap: () => void
  onBrowsePaperTopics: (offering: Offering, subject: Subject, paper: Paper) => void
  onStartSession: (
    scored: ScoredTopic,
    source: ScheduleSource,
    scheduleItemId?: string,
  ) => void
  onStartPaperSession: (
    paper: Paper,
    offering: Offering,
    subject: Subject,
    source: PaperAttemptSource,
    options?: { selectionRequired?: boolean },
  ) => void
}

export default function AppOverlays({
  onboarded,
  showOnboarding,
  editingSetup,
  activeSession,
  activeOffering,
  activeSubject,
  activePaper,
  activeSubjectBrowseContext,
  onCompleteOnboarding,
  onBackToHome,
  onCompleteEdit,
  onCancelEdit,
  onCloseSession,
  onGoToProgress,
  onCloseSubjectPicker,
  onCompletePlanNowSwap,
  onBrowsePaperTopics,
  onStartSession,
  onStartPaperSession,
}: AppOverlaysProps) {
  if (!onboarded) {
    if (!showOnboarding) return null

    return (
      <Onboarding
        onComplete={onCompleteOnboarding}
        onBackToHome={onBackToHome}
      />
    )
  }

  if (editingSetup) {
    return (
      <Onboarding
        mode="edit"
        onComplete={onCompleteEdit}
        onCancel={onCancelEdit}
      />
    )
  }

  if (activeSession) {
    if (activeSession.kind === 'paper') {
      return (
        <PaperSessionLogger
          paper={activeSession.paper}
          offering={activeSession.offering}
          subject={activeSession.subject}
          source={activeSession.source}
          selectionRequired={activeSession.selectionRequired}
          restored={activeSession.restored}
          onBack={onCloseSession}
          onGoToProgress={onGoToProgress}
          onBrowseTopics={(paper) => onBrowsePaperTopics(activeSession.offering, activeSession.subject, paper)}
        />
      )
    }

    return (
      <SessionLogger
        scored={activeSession.scored}
        source={activeSession.source}
        scheduleItemId={activeSession.scheduleItemId}
        onBack={onCloseSession}
        onGoToProgress={onGoToProgress}
      />
    )
  }

  if (activeOffering && activeSubject) {
    return (
      <SubjectPicker
        offering={activeOffering}
        subject={activeSubject}
        paper={activePaper}
        planNowTopicId={activeSubjectBrowseContext?.planNowTopicId ?? null}
        onBack={onCloseSubjectPicker}
        onCompletePlanNowSwap={onCompletePlanNowSwap}
        onStartSession={onStartSession}
        onStartPaperSession={onStartPaperSession}
      />
    )
  }

  return null
}
