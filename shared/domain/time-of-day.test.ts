import { describe, expect, it } from 'vitest'
import { timeOfDay } from './time-of-day'
import { minLikes } from './quality'

describe('time of day', () => {
  it('US-20.3 puts each in-game time in one range, night around midnight', () => {
    expect(
      ['04:59', '05:00', '08:59', '09:00', '16:59', '17:00', '20:59', '21:00', '23:59', '00:00'].map(timeOfDay),
    ).toEqual(['night', 'dawn', 'dawn', 'day', 'day', 'dusk', 'dusk', 'night', 'night', 'night'])
  })
})

describe('minimum quality', () => {
  it('US-20.3 gives the fewest likes of a tier, from the thresholds of the settings', () => {
    const thresholds = { uncommon: 3, rare: 15, epic: 50, legendary: 150 }
    expect(minLikes('poor', thresholds)).toBe(0)
    expect(minLikes('rare', thresholds)).toBe(15)
    expect(minLikes('legendary', { ...thresholds, legendary: 200 })).toBe(200)
  })
})
