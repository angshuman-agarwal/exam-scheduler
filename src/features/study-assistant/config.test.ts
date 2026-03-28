import { afterEach, describe, expect, it } from 'vitest'
import { getStudyAssistantAvailability } from './config'

const originalEnabled = import.meta.env.VITE_STUDY_ASSISTANT_ENABLED
const originalTutoringBaseUrl = import.meta.env.VITE_TUTORING_API_BASE_URL

afterEach(() => {
  import.meta.env.VITE_STUDY_ASSISTANT_ENABLED = originalEnabled
  import.meta.env.VITE_TUTORING_API_BASE_URL = originalTutoringBaseUrl
})

describe('getStudyAssistantAvailability', () => {
  it('defaults to enabled while tutoring is not ready without an api base url', () => {
    import.meta.env.VITE_STUDY_ASSISTANT_ENABLED = undefined
    import.meta.env.VITE_TUTORING_API_BASE_URL = ''

    expect(getStudyAssistantAvailability()).toEqual({
      enabled: true,
      tutoringReady: false,
    })
  })

  it('disables the assistant when the feature flag is false', () => {
    import.meta.env.VITE_STUDY_ASSISTANT_ENABLED = 'false'
    import.meta.env.VITE_TUTORING_API_BASE_URL = 'https://tutor.example.com'

    expect(getStudyAssistantAvailability()).toEqual({
      enabled: false,
      tutoringReady: true,
    })
  })
})
