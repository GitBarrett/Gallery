import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import { aProfile } from '../../../tests/builders/accounts'
import { aCapture } from '../../../tests/builders/captures'
import PublicProfile from './PublicProfile.vue'

const profile = aProfile({ username: 'Lunelame' })
registerEndpoint('/api/users/Lunelame/photos', () => ({
  items: [
    aCapture({ id: '0193a000-0000-7000-8000-0000000000c1', title: 'Moonwell', likes: 12, quality: 'uncommon' }),
    aCapture({ id: '0193a000-0000-7000-8000-0000000000c2', title: 'Sunwell', likes: 160, quality: 'legendary' }),
  ],
  nextCursor: null,
}))
registerEndpoint('/api/settings/public', () => ({
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
}))

describe('PublicProfile captures', () => {
  it('US-05.3 lists the public captures of the profile, without progress for a visitor', async () => {
    const wrapper = await mountSuspended(PublicProfile, { props: { profile, own: false } })
    await vi.waitFor(() => expect(wrapper.findAll('article')).toHaveLength(2))
    expect(wrapper.text()).toContain('Moonwell')
    expect(wrapper.find('progress').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('No captures yet')
  })

  it('US-05.3 shows on one’s own captures the likes towards the next tier', async () => {
    const wrapper = await mountSuspended(PublicProfile, { props: { profile, own: true } })
    await vi.waitFor(() => expect(wrapper.findAll('progress')).toHaveLength(2))
    const [moonwell, sunwell] = wrapper.findAll('progress')
    expect(moonwell!.attributes()).toMatchObject({ value: '9', max: '12', 'aria-label': '3 likes to Rare' })
    expect(sunwell!.attributes()).toMatchObject({ value: '1', max: '1', 'aria-label': 'Legendary: the highest tier' })
    expect(await axeViolations(wrapper.element)).toEqual([])
  })
})
