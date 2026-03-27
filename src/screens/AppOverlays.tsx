import Onboarding from '../components/Onboarding'
import SubjectPicker from '../components/SubjectPicker'
import SessionLogger from '../components/SessionLogger'
import type { Offering, Paper, ScheduleSource, ScoredTopic, Subject } from '../types'

interface ActiveSessionState {
  scored: ScoredTopic
  source: ScheduleSource
  scheduleItemId?: string
}

interface AppOverlaysProps {
  onboarded: boolean
  showOnboarding: boolean
  editingSetup: boolean
  activeSession: ActiveSessionState | null
  activeOffering: Offering | null
  activeSubject: Subject | null
  activePaper: Paper | null
  onCompleteOnboarding: () => void
  onBackToHome: () => void
  onCompleteEdit: () => void
  onCancelEdit: () => void
  onCloseSession: () => void
  onGoToProgress: () => void
  onCloseSubjectPicker: () => void
  onStartSession: (
    scored: ScoredTopic,
    source: ScheduleSource,
    scheduleItemId?: string,
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
  onCompleteOnboarding,
  onBackToHome,
  onCompleteEdit,
  onCancelEdit,
  onCloseSession,
  onGoToProgress,
  onCloseSubjectPicker,
  onStartSession,
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
        onBack={onCloseSubjectPicker}
        onStartSession={onStartSession}
      />
    )
  }

  return null
}
