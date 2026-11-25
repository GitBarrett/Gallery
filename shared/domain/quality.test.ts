import { describe, expect, it } from 'vitest'
import { QUALITIES, qualityFromLikes, qualityProgress } from './quality'

// Launch values (07-design.md § Codes visuels WoW); the real ones come from site_settings.quality_thresholds.
const launch = { uncommon: 3, rare: 15, epic: 50, legendary: 150 }

describe('qualityFromLikes', () => {
  it.each([
    [0, 'poor'],
    [2, 'poor'],
    [3, 'uncommon'],
    [14, 'uncommon'],
    [15, 'rare'],
    [49, 'rare'],
    [50, 'epic'],
    [149, 'epic'],
    [150, 'legendary'],
    [10_000, 'legendary'],
  ])('%i likes gives %s with the launch thresholds', (likes, quality) => {
    expect(qualityFromLikes(likes, launch)).toBe(quality)
  })

  it('reads the thresholds it is given, never hard-coded ones', () => {
    const target = { uncommon: 10, rare: 100, epic: 500, legendary: 1000 }
    expect(qualityFromLikes(150, target)).toBe('rare')
    expect(qualityFromLikes(1000, target)).toBe('legendary')
  })

  it('lists the tiers from lowest to highest', () => {
    expect(QUALITIES).toEqual(['poor', 'uncommon', 'rare', 'epic', 'legendary'])
  })
})

describe('qualityProgress', () => {
  it('US-71.2 gives the tier, its threshold and the likes missing for the next one', () => {
    expect(qualityProgress(0, launch)).toEqual({ quality: 'poor', from: 0, next: { quality: 'uncommon', missing: 3 } })
    expect(qualityProgress(15, launch)).toEqual({ quality: 'rare', from: 15, next: { quality: 'epic', missing: 35 } })
    expect(qualityProgress(149, launch).next).toEqual({ quality: 'legendary', missing: 1 })
    expect(qualityProgress(400, launch)).toEqual({ quality: 'legendary', from: 150, next: null })
  })
})
