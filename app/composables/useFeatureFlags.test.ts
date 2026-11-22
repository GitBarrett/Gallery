import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { useFeatureFlags } from './useFeatureFlags'

const features = {
  contests: true,
  follows: false,
  collections: false,
  leaderboard: true,
  ads: false,
  donations: false,
  readonly: false,
  inviteOnly: true,
}
registerEndpoint('/api/settings/public', () => ({
  qualityThresholds: { uncommon: 3, rare: 15, epic: 50, legendary: 150 },
  features,
}))

describe('useFeatureFlags', () => {
  it('US-56.3 shows the navigation entries of the flags enabled in the settings, hidden until known', async () => {
    const flags = useFeatureFlags()
    expect(flags.value).toEqual({ leaderboard: false, contests: false, collections: false })
    await vi.waitFor(() => expect(flags.value).toMatchObject({ leaderboard: true, contests: true, collections: false }))
  })
})
