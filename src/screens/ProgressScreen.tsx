import Progress from '../components/Progress'
import type { Offering, Paper, Subject } from '../types'

interface ProgressScreenProps {
  onGoToToday: () => void
  onBrowseOffering: (offering: Offering, subject: Subject, paper?: Paper | null) => void
  onPlanNowTopic: (offering: Offering, subject: Subject, topicId: string) => void
}

export default function ProgressScreen({ onGoToToday, onBrowseOffering, onPlanNowTopic }: ProgressScreenProps) {
  return <Progress onGoToToday={onGoToToday} onBrowseOffering={onBrowseOffering} onPlanNowTopic={onPlanNowTopic} />
}
