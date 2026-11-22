import { $fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { describe, expect, it } from 'vitest'
import { PublicSettings } from '../../shared/contracts/settings'

process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
await startTestServer()

describe('GET /api/settings/public', () => {
  it('US-71.5 serves the quality thresholds and the feature flags to an anonymous visitor', async () => {
    // No database in the test server: the launch values apply
    expect(PublicSettings.parse(await $fetch('/api/settings/public'))).toEqual({
      qualityThresholds: { uncommon: 3, rare: 15, epic: 50, legendary: 150 },
      features: {
        contests: false,
        follows: false,
        collections: false,
        leaderboard: false,
        ads: false,
        donations: false,
        readonly: false,
        inviteOnly: true,
      },
    })
  })
})
