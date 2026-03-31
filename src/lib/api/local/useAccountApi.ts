import { useAppStore } from '../../../stores/app.store'
import type { AccountContext } from '../types'

export function useLocalAccountApi(): AccountContext {
  const initialized = useAppStore((state) => state.initialized)
  const onboarded = useAppStore((state) => state.onboarded)
  const studyMode = useAppStore((state) => state.studyMode)

  return {
    initialized,
    onboarded,
    studyMode,
  }
}
