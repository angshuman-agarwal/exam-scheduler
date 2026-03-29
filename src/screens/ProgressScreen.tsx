import Progress from '../components/Progress'
import type { Offering, Paper, Subject } from '../types'

interface ProgressScreenProps {
  onGoToToday: () => void
  onBrowseOffering: (offering: Offering, subject: Subject, paper?: Paper | null) => void
}

export default function ProgressScreen({ onGoToToday, onBrowseOffering }: ProgressScreenProps) {
  return <Progress onGoToToday={onGoToToday} onBrowseOffering={onBrowseOffering} />
}
