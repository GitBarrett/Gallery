import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import QuestLog from './QuestLog.vue'

const photo = '0193a000-0000-7000-8000-000000000001'
registerEndpoint('/api/notifications', () => ({
  notifications: [
    {
      id: '0193a000-0000-7000-8000-000000000201',
      type: 'quality',
      actor: null,
      others: 0,
      photoId: photo,
      photoTitle: 'Ice Crown',
      detail: 'poor',
      read: false,
      createdAt: new Date().toISOString(),
    },
  ],
}))
registerEndpoint('/api/settings/public', () => ({
  qualityThresholds: { uncommon: 10, rare: 50, epic: 150, legendary: 500 },
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
}))

describe('QuestLog', () => {
  it('US-71.3 explains the quality on the first public capture, the current threshold, linked to the help', async () => {
    const log = await mountSuspended(QuestLog)
    await vi.waitFor(() =>
      expect(log.text()).toContain(
        'Your first capture “Ice Crown” is online! Like items in the game, it earns a quality from likes: Poor for now, 10 likes to Uncommon.',
      ),
    )
    expect(log.get('li a').attributes('href')).toBe('/help/quality')
  })
})
