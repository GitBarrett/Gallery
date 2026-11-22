import { describe, expect, it } from 'vitest'
import { LAUNCH_SETTINGS, validateSetting } from './settings'

describe('site settings rules', () => {
  it('ships the launch values: quality 3/15/50/150, 3 reports to hide, invite-only beta, every v1.x flag off', () => {
    expect(LAUNCH_SETTINGS['quality.thresholds']).toEqual({ uncommon: 3, rare: 15, epic: 50, legendary: 150 })
    expect(LAUNCH_SETTINGS['moderation.reportsToHide']).toBe(3)
    expect(LAUNCH_SETTINGS['features.inviteOnly']).toBe(true)
    const others = Object.entries(LAUNCH_SETTINGS).filter(
      ([k]) => k.startsWith('features.') && k !== 'features.inviteOnly',
    )
    expect(others.every(([, v]) => v === false)).toBe(true)
  })

  it('accepts every launch value', () => {
    for (const [key, value] of Object.entries(LAUNCH_SETTINGS)) expect(validateSetting(key, value).ok).toBe(true)
  })

  it('US-56.2 refuses quality thresholds that are not strictly ascending, with the reason', () => {
    expect(validateSetting('quality.thresholds', { uncommon: 3, rare: 15, epic: 15, legendary: 150 })).toEqual({
      ok: false,
      error: 'thresholds_not_ascending',
    })
  })

  it('US-56.2 refuses moderation scores where review is not below reject', () => {
    expect(validateSetting('moderation.scores', { review: 0.9, reject: 0.85 })).toEqual({
      ok: false,
      error: 'thresholds_not_ascending',
    })
  })

  it('US-56.2 refuses a hero whose luminance is above 0.6, with the reason', () => {
    const photoId = '019a0000-0000-7000-8000-000000000000'
    expect(validateSetting('home.hero', { photoId, luminance: 0.61 })).toEqual({ ok: false, error: 'hero_too_bright' })
    expect(validateSetting('home.hero', { photoId, luminance: 0.6 }).ok).toBe(true)
  })

  it('US-56.2 refuses a value of the wrong shape and an unknown key', () => {
    expect(validateSetting('moderation.reportsToHide', 0)).toEqual({ ok: false, error: 'invalid_value' })
    expect(validateSetting('features.contests', 'yes')).toEqual({ ok: false, error: 'invalid_value' })
    expect(validateSetting('quality.thresholds', { uncommon: 3, rare: 15, epic: 50, legendary: 150, x: 1 })).toEqual({
      ok: false,
      error: 'invalid_value',
    })
    expect(validateSetting('features.unknown', true)).toEqual({ ok: false, error: 'unknown_key' })
  })
})
