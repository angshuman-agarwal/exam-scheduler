import TodayPlan from '../components/TodayPlan'
import type { Offering, Paper, PaperAttemptSource, ScheduleSource, ScoredTopic, Subject } from '../types'

interface TodayScreenProps {
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
  onBrowseOffering: (offering: Offering, subject: Subject, paper?: Paper | null) => void
  onEditSubjects: () => void
  recentlySwappedTopicId: string | null
  onClearRecentlySwappedTopic: () => void
}

export default function TodayScreen({
  onStartSession,
  onStartPaperSession,
  onBrowseOffering,
  onEditSubjects,
  recentlySwappedTopicId,
  onClearRecentlySwappedTopic,
}: TodayScreenProps) {
  return (
    <TodayPlan
      onStartSession={onStartSession}
      onStartPaperSession={onStartPaperSession}
      onBrowseOffering={onBrowseOffering}
      onEditSubjects={onEditSubjects}
      recentlySwappedTopicId={recentlySwappedTopicId}
      onClearRecentlySwappedTopic={onClearRecentlySwappedTopic}
    />
  )
}
