import {
  TutoringApiError,
  type GradeInput,
  type GradeResult,
  type LookupInput,
  type LookupResult,
  type MarkSchemeInput,
  type MarkSchemeResult,
  type QuizInput,
  type QuizResult,
  type SearchInput,
  type SearchResultItem,
  type TutoringApi,
} from '../types'

interface SuccessEnvelope<T> {
  ok: true
  data: T
}

interface ErrorEnvelope {
  ok: false
  error?: {
    code?: string
    message?: string
  }
}

function getTutoringApiBaseUrl() {
  return import.meta.env.VITE_TUTORING_API_BASE_URL?.trim() ?? ''
}

function getTutoringUrl(path: string) {
  const baseUrl = getTutoringApiBaseUrl()
  if (!baseUrl) {
    throw new TutoringApiError(
      'TUTORING_API_NOT_CONFIGURED',
      'Tutoring API base URL is not configured.',
    )
  }

  return new URL(path, baseUrl).toString()
}

function createQueryString(input: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      params.set(key, String(value))
    }
  }

  return params.toString()
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as SuccessEnvelope<T> | ErrorEnvelope

  if (!response.ok || !payload.ok) {
    throw new TutoringApiError(
      payload.ok ? 'TUTORING_API_REQUEST_FAILED' : (payload.error?.code ?? 'TUTORING_API_REQUEST_FAILED'),
      payload.ok ? 'Tutoring API request failed.' : (payload.error?.message ?? 'Tutoring API request failed.'),
    )
  }

  return payload.data
}

export const httpTutoringApi: TutoringApi = {
  async search(input: SearchInput): Promise<SearchResultItem[]> {
    const query = createQueryString({
      query: input.query,
      subject: input.subject,
      type: input.type,
      limit: input.limit,
    })
    const response = await fetch(getTutoringUrl(`/api/tutoring/search${query ? `?${query}` : ''}`))
    return readEnvelope<SearchResultItem[]>(response)
  },
  async lookup(input: LookupInput): Promise<LookupResult> {
    const query = createQueryString({
      topic: input.topic,
      subject: input.subject,
      maxTokens: input.maxTokens,
    })
    const response = await fetch(getTutoringUrl(`/api/tutoring/lookup?${query}`))
    return readEnvelope<LookupResult>(response)
  },
  async quiz(input: QuizInput): Promise<QuizResult> {
    const query = createQueryString({
      topic: input.topic,
      subject: input.subject,
      question: input.question,
    })
    const response = await fetch(getTutoringUrl(`/api/tutoring/quiz?${query}`))
    return readEnvelope<QuizResult>(response)
  },
  async markscheme(input: MarkSchemeInput): Promise<MarkSchemeResult> {
    const query = createQueryString({
      topic: input.topic,
      subject: input.subject,
      question: input.question,
    })
    const response = await fetch(getTutoringUrl(`/api/tutoring/markscheme?${query}`))
    return readEnvelope<MarkSchemeResult>(response)
  },
  async grade(input: GradeInput): Promise<GradeResult> {
    const response = await fetch(getTutoringUrl('/api/tutoring/grade'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })
    return readEnvelope<GradeResult>(response)
  },
}
