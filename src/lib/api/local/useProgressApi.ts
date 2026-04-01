import { useAppStore } from '../../../stores/app.store'
import { useLocalAccountApi } from './useAccountApi'
import type { ProgressContext } from '../types'

export function useLocalProgressApi(): ProgressContext {
  const { studyMode } = useLocalAccountApi()
  const topics = useAppStore((state) => state.topics)
  const sessions = useAppStore((state) => state.sessions)
  const paperAttempts = useAppStore((state) => state.paperAttempts)
  const subjects = useAppStore((state) => state.subjects)
  const papers = useAppStore((state) => state.papers)
  const offerings = useAppStore((state) => state.offerings)
  const selectedOfferingIds = useAppStore((state) => state.selectedOfferingIds)
  const notes = useAppStore((state) => state.notes)

  return {
    studyMode,
    topics,
    sessions,
    paperAttempts,
    subjects,
    papers,
    offerings,
    selectedOfferingIds,
    notes,
  }
}
