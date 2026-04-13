import LandingPage from '../components/LandingPage'
import FeedbackSheet from '../components/FeedbackSheet'

interface HomeScreenProps {
  showFeedback: boolean
  onContinuePlanning: () => void
  onViewProgress: () => void
  onEditSubjects: () => void
  onCloseFeedback: () => void
  nearestUserExam: { days: number; subjectName: string; paperName: string; board: string } | null
  selectedSubjectDetails: { name: string; board: string }[]
}

export default function HomeScreen({
  showFeedback,
  onContinuePlanning,
  onViewProgress,
  onEditSubjects,
  onCloseFeedback,
  nearestUserExam,
  selectedSubjectDetails,
}: HomeScreenProps) {
  return (
    <>
      <LandingPage
        onboarded={true}
        onGetStarted={() => {}}
        onContinuePlanning={onContinuePlanning}
        onViewProgress={onViewProgress}
        onEditSubjects={onEditSubjects}
        nearestUserExam={nearestUserExam}
        selectedSubjectDetails={selectedSubjectDetails}
      />
      {showFeedback && <FeedbackSheet onClose={onCloseFeedback} />}
    </>
  )
}
