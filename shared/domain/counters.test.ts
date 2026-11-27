import { describe, expect, it } from 'vitest'
import { COUNTER_MIN, isNew, NEW_FOR_MS, shownCount } from './counters'

describe('counters', () => {
  it('US-70.6 shows no counter under 10', () => {
    expect(COUNTER_MIN).toBe(10)
    expect([0, 4, 9, 10, 1284].map(shownCount)).toEqual([false, false, false, true, true])
  })

  it('US-70.6 calls a capture New for 7 days after its publication', () => {
    const now = new Date('2026-11-27T12:00:00Z')
    expect(NEW_FOR_MS).toBe(7 * 86_400_000)
    expect(isNew(new Date(now.getTime() - NEW_FOR_MS + 1), now)).toBe(true)
    expect(isNew(new Date(now.getTime() - NEW_FOR_MS).toISOString(), now)).toBe(false)
  })
})
