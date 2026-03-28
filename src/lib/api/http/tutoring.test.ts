import { afterEach, describe, expect, it, vi } from 'vitest'
import { TutoringApiError } from '../types'
import { httpTutoringApi } from './tutoring'

const originalEnv = import.meta.env.VITE_TUTORING_API_BASE_URL

afterEach(() => {
  vi.restoreAllMocks()
  import.meta.env.VITE_TUTORING_API_BASE_URL = originalEnv
})

describe('httpTutoringApi', () => {
  it('fails clearly when base URL is missing', async () => {
    import.meta.env.VITE_TUTORING_API_BASE_URL = ''

    await expect(httpTutoringApi.search({ query: 'macbeth' })).rejects.toMatchObject({
      name: 'TutoringApiError',
      code: 'TUTORING_API_NOT_CONFIGURED',
    } satisfies Partial<TutoringApiError>)
  })

  it('queries the quiz endpoint with search params', async () => {
    import.meta.env.VITE_TUTORING_API_BASE_URL = 'https://tutor.example.com'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            topic: 'macbeth',
            subject: 'eng-lit',
            matchedTopic: 'macbeth',
            file: '/tmp/macbeth-qp.md',
            msFile: '/tmp/macbeth-ms.md',
            transcriptFile: null,
            audioFile: null,
            transcript: null,
            question: 'How is Macbeth presented as ambitious?',
            questionNumber: 2,
            totalQuestions: 5,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    )

    await expect(httpTutoringApi.quiz({
      topic: 'macbeth',
      subject: 'eng-lit',
      question: 2,
    })).resolves.toMatchObject({
      topic: 'macbeth',
      questionNumber: 2,
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://tutor.example.com/api/tutoring/quiz?topic=macbeth&subject=eng-lit&question=2',
    )
  })

  it('posts grade requests to the grade endpoint', async () => {
    import.meta.env.VITE_TUTORING_API_BASE_URL = 'https://tutor.example.com'
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            topic: 'macbeth',
            subject: 'eng-lit',
            matchedTopic: 'macbeth',
            file: '/tmp/macbeth-qp.md',
            msFile: '/tmp/macbeth-ms.md',
            transcriptFile: null,
            audioFile: null,
            transcript: null,
            question: 'How is Macbeth presented as ambitious?',
            markScheme: 'Reward analysis of ambition.',
            answer: 'Macbeth is ambitious because...',
            estimatedMarks: 3,
            maxMarks: 4,
            confidence: 'medium',
            matchedPoints: ['Mentions ambition'],
            missedPoints: ['Lacks quotation analysis'],
            summary: 'A reasonable answer with one missed detail.',
            questionNumber: 1,
            totalQuestions: 5,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    )

    await expect(httpTutoringApi.grade({
      topic: 'macbeth',
      subject: 'eng-lit',
      answer: 'Macbeth is ambitious because...',
    })).resolves.toMatchObject({
      estimatedMarks: 3,
      confidence: 'medium',
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://tutor.example.com/api/tutoring/grade',
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })
})
