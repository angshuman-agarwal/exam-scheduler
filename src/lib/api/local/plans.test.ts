import { describe, expect, it } from 'vitest'
import { localPlansApi } from './plans'

describe('localPlansApi', () => {
  it('returns today plan items when plan day matches', () => {
    const today = new Date(2026, 2, 27, 10, 0, 0)
    const items = [
      { id: 'one', topicId: 'topic-1', source: 'auto' as const, addedAt: 1, dayKey: '2026-03-27' },
    ]

    expect(
      localPlansApi.getPlanItems({
        dailyPlan: items,
        planDay: '2026-03-27',
        today,
      }),
    ).toEqual(items)
  })

  it('returns an empty plan when plan day is stale', () => {
    expect(
      localPlansApi.getPlanItems({
        dailyPlan: [
          { id: 'one', topicId: 'topic-1', source: 'auto' as const, addedAt: 1, dayKey: '2026-03-26' },
        ],
        planDay: '2026-03-26',
        today: new Date(2026, 2, 27, 10, 0, 0),
      }),
    ).toEqual([])
  })
})
