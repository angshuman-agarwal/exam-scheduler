import Progress from '../components/Progress'

interface ProgressScreenProps {
  onGoToToday: () => void
}

export default function ProgressScreen({ onGoToToday }: ProgressScreenProps) {
  return <Progress onGoToToday={onGoToToday} />
}
