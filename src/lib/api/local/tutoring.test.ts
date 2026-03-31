import { describe, expect, it } from 'vitest'
import { localTutoringApi } from './tutoring'

describe('localTutoringApi', () => {
  it('returns an empty result set for search', async () => {
    await expect(localTutoringApi.search({ query: 'macbeth' })).resolves.toEqual([])
  })

  it('returns quiz-shaped placeholder data', async () => {
    await expect(localTutoringApi.quiz({ topic: 'macbeth', subject: 'eng-lit', question: 2 })).resolves.toMatchObject({
      topic: 'macbeth',
      subject: 'eng-lit',
      matchedTopic: 'macbeth',
      questionNumber: 2,
      totalQuestions: 0,
    })
  })

  it('returns grade-shaped placeholder data', async () => {
    await expect(localTutoringApi.grade({
      topic: 'macbeth',
      subject: 'eng-lit',
      answer: 'Lady Macbeth is ambitious',
    })).resolves.toMatchObject({
      topic: 'macbeth',
      subject: 'eng-lit',
      answer: 'Lady Macbeth is ambitious',
      confidence: 'low',
    })
  })
})
