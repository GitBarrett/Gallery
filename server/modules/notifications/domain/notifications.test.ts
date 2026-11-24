import { describe, expect, it } from 'vitest'
import { purgeLimit, wanted, withLiker } from './notifications'

const all = { likes: true, comments: true, followers: true, contests: true }
const none = { likes: false, comments: false, followers: false, contests: false }

describe('notifications rules', () => {
  it('US-35.4 follows the preference of each type; moderation and quality cannot be turned off', () => {
    expect(wanted('like', { ...all, likes: false })).toBe(false)
    expect(wanted('comment', { ...all, comments: false })).toBe(false)
    expect(wanted('follow', { ...all, followers: false })).toBe(false)
    expect(wanted('contest', { ...all, contests: false })).toBe(false)
    expect(wanted('like', all)).toBe(true)
    expect(wanted('moderation', none)).toBe(true)
    expect(wanted('quality', none)).toBe(true)
  })

  it('US-35.2 puts the latest liker last and counts a liker once', () => {
    expect(withLiker(['ash'], 'tyrande')).toEqual(['ash', 'tyrande'])
    expect(withLiker(['ash', 'tyrande'], 'ash')).toEqual(['tyrande', 'ash'])
  })

  it('US-35.5 keeps 6 months of notifications', () => {
    expect(purgeLimit(new Date('2026-11-24T03:15:00Z'))).toEqual(new Date('2026-05-24T03:15:00Z'))
  })
})
