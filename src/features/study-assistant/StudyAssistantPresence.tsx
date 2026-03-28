import StudyAssistantLauncher from './StudyAssistantLauncher'
import StudyAssistantPanel from './StudyAssistantPanel'
import type { StudyAssistantController } from './types'

interface StudyAssistantPresenceProps {
  assistant: StudyAssistantController
  currentPage: 'home' | 'today' | 'progress'
  subjectCount: number
}

export default function StudyAssistantPresence({
  assistant,
  currentPage,
  subjectCount,
}: StudyAssistantPresenceProps) {
  if (!assistant.isEnabled) return null

  return (
    <>
      <StudyAssistantPanel
        currentPage={currentPage}
        error={assistant.error}
        isOpen={assistant.isOpen}
        mode={assistant.mode}
        onClose={assistant.closeAssistant}
        onOpenMode={(mode) => {
          assistant.setMode(mode)
          assistant.openAssistant(mode)
        }}
        subjectCount={subjectCount}
        tutoringReady={assistant.tutoringReady}
      />
      <StudyAssistantLauncher
        isOpen={assistant.isOpen}
        onOpen={assistant.openAssistant}
      />
    </>
  )
}
