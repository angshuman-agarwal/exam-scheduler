import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TutoringApiError, type TutoringApi } from '../../lib/api/types'
import { createInitialStudyAssistantState, useStudyAssistant } from './useStudyAssistant'

afterEach(() => {
  document.body.innerHTML = ''
})

function requireLatest(
  value: ReturnType<typeof useStudyAssistant> | null,
): ReturnType<typeof useStudyAssistant> {
  if (!value) {
    throw new Error('Hook value was not captured')
  }

  return value
}

describe('study assistant state', () => {
  it('creates a closed idle initial state', () => {
    expect(createInitialStudyAssistantState()).toEqual({
      isOpen: false,
      mode: 'search',
      status: 'idle',
      error: null,
      result: {
        search: null,
        lookup: null,
        quiz: null,
        markscheme: null,
        grade: null,
      },
    })
  })

  it('opens, runs quiz, and stores quiz result', async () => {
    const api: TutoringApi = {
      search: vi.fn().mockResolvedValue([]),
      lookup: vi.fn(),
      quiz: vi.fn().mockResolvedValue({
        topic: 'macbeth',
        subject: 'eng-lit',
        matchedTopic: 'macbeth',
        file: '/tmp/macbeth-qp.md',
        msFile: '/tmp/macbeth-ms.md',
        transcriptFile: null,
        audioFile: null,
        transcript: null,
        question: 'How is Macbeth presented as ambitious?',
        questionNumber: 1,
        totalQuestions: 5,
      }),
      markscheme: vi.fn(),
      grade: vi.fn(),
    }

    let latest: ReturnType<typeof useStudyAssistant> | null = null
    function Harness({ onValue }: { onValue: (value: ReturnType<typeof useStudyAssistant>) => void }) {
      const value = useStudyAssistant(api)

      useEffect(() => {
        onValue(value)
      }, [onValue, value])

      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(<Harness onValue={(value) => { latest = value }} />)
    })

    const initial = requireLatest(latest)

    await act(async () => {
      initial.openAssistant('quiz')
      await initial.runQuiz({ topic: 'macbeth', subject: 'eng-lit' })
    })

    const updated = requireLatest(latest)

    expect(updated.isOpen).toBe(true)
    expect(updated.mode).toBe('quiz')
    expect(updated.status).toBe('success')
    expect(updated.result.quiz?.topic).toBe('macbeth')

    await act(async () => {
      root.unmount()
    })
  })

  it('captures tutoring api errors', async () => {
    const api: TutoringApi = {
      search: vi.fn().mockRejectedValue(new TutoringApiError('TOPIC_NOT_FOUND', 'Topic not found.')),
      lookup: vi.fn(),
      quiz: vi.fn(),
      markscheme: vi.fn(),
      grade: vi.fn(),
    }

    let latest: ReturnType<typeof useStudyAssistant> | null = null
    function Harness({ onValue }: { onValue: (value: ReturnType<typeof useStudyAssistant>) => void }) {
      const value = useStudyAssistant(api)

      useEffect(() => {
        onValue(value)
      }, [onValue, value])

      return null
    }

    const container = document.createElement('div')
    const root = createRoot(container)

    await act(async () => {
      root.render(<Harness onValue={(value) => { latest = value }} />)
    })

    const current = requireLatest(latest)

    await act(async () => {
      await expect(current.runSearch({ query: 'missing topic' })).rejects.toBeInstanceOf(TutoringApiError)
    })

    const updated = requireLatest(latest)

    expect(updated.status).toBe('error')
    expect(updated.error).toBe('Topic not found.')

    await act(async () => {
      root.unmount()
    })
  })
})
