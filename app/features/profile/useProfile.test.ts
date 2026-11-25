import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { setResponseStatus } from 'h3'
import { describe, expect, it } from 'vitest'
import { useProfile } from './useProfile'

registerEndpoint('/api/users/Ash_Barrett', () => ({
  username: 'Ash_Barrett',
  avatarUrl: null,
  bio: null,
  memberSince: '2026-11-01T10:00:00.000Z',
  socialLinks: [],
}))
registerEndpoint('/api/users/nobody', (event) => {
  setResponseStatus(event, 404)
  return { error: { code: 'NOT_FOUND', message: 'Not found', correlationId: 'c' } }
})

describe('useProfile', () => {
  it('US-05.3 loads the public profile of a username', async () => {
    const { profile } = await useProfile(ref('Ash_Barrett'))
    expect(profile.value).toEqual({
      username: 'Ash_Barrett',
      avatarUrl: null,
      bio: null,
      memberSince: '2026-11-01T10:00:00.000Z',
      socialLinks: [],
    })
  })

  it('US-05.3 gives null for an unknown, banned or deleted account (the page answers 404)', async () => {
    const { profile } = await useProfile(ref('nobody'))
    expect(profile.value).toBeNull()
  })
})
