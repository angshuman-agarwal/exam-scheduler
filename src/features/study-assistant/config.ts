export interface StudyAssistantAvailability {
  enabled: boolean
  tutoringReady: boolean
}

function readBooleanEnv(value: string | undefined, fallback: boolean) {
  if (value == null) return fallback

  const normalized = value.trim().toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0') return false

  return fallback
}

export function getStudyAssistantAvailability(): StudyAssistantAvailability {
  const enabled = readBooleanEnv(import.meta.env.VITE_STUDY_ASSISTANT_ENABLED, true)
  const tutoringReady = Boolean(import.meta.env.VITE_TUTORING_API_BASE_URL?.trim())

  return {
    enabled,
    tutoringReady,
  }
}
