import { describe, expect, it } from 'vitest'
import { notificationPrefs } from './notification-prefs'

describe('notification preferences', () => {
  it('US-35.4 turns every type on by default, off only when stored false', () => {
    expect(notificationPrefs({})).toEqual({ likes: true, comments: true, followers: true, contests: true })
    expect(notificationPrefs(null)).toEqual({ likes: true, comments: true, followers: true, contests: true })
    expect(notificationPrefs({ likes: false, comments: 'no', unknown: false })).toEqual({
      likes: false,
      comments: true,
      followers: true,
      contests: true,
    })
  })
})
