import TodayPlan from '../components/TodayPlan'
import type { Offering, Paper, ScheduleSource, ScoredTopic, Subject } from '../types'

interface TodayScreenProps {
  onStartSession: (
    scored: ScoredTopic,
    source: ScheduleSource,
    scheduleItemId?: string,
  ) => void
  onBrowseOffering: (offering: Offering, subject: Subject, paper?: Paper | null) => void
  onEditSubjects: () => void
}

export default function TodayScreen({
  onStartSession,
  onBrowseOffering,
  onEditSubjects,
}: TodayScreenProps) {
  return (
    <TodayPlan
      onStartSession={onStartSession}
      onBrowseOffering={onBrowseOffering}
      onEditSubjects={onEditSubjects}
    />
  )
}
