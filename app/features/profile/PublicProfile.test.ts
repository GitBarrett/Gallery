import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import PublicProfile from './PublicProfile.vue'

const profile = {
  username: 'Ash_Barrett',
  avatarUrl: null,
  bio: '<b>Night elf</b> hunter.',
  memberSince: '2026-11-01T10:00:00.000Z',
  socialLinks: [{ platform: 'twitch' as const, label: 'Ash_Barrett', url: 'https://twitch.tv/Ash_Barrett' }],
}

describe('PublicProfile', () => {
  it('US-05.3 shows the username, the bio as text, the membership date and the empty captures', async () => {
    const wrapper = await mountSuspended(PublicProfile, { props: { profile, own: false } })
    expect(wrapper.get('h1').text()).toBe('Ash_Barrett')
    expect(wrapper.find('b').exists()).toBe(false) // user text is never interpreted
    expect(wrapper.text()).toContain('<b>Night elf</b> hunter.')
    expect(wrapper.text()).toContain('Member since November 2026')
    expect(wrapper.text()).toContain('No captures yet')
    expect(wrapper.find('a[href="/settings"]').exists()).toBe(false)
  })

  it('US-82.4 shows the social links under the bio', async () => {
    const wrapper = await mountSuspended(PublicProfile, { props: { profile, own: false } })
    expect(wrapper.get('.about a[href="https://twitch.tv/Ash_Barrett"]').text()).toBe('Ash_Barrett')
  })

  it('US-05.3 shows the avatar of the member, or their initial', async () => {
    const avatarUrl = '/avatar/0193a000-0000-7000-8000-0000000000a1/0193a000-0000-7000-8000-0000000000b2'
    const shown = await mountSuspended(PublicProfile, { props: { profile: { ...profile, avatarUrl }, own: false } })
    expect(shown.get('.identity img').attributes('src')).toBe(`${avatarUrl}/256`)
    const initial = await mountSuspended(PublicProfile, { props: { profile, own: false } })
    expect(initial.get('.identity').text()).toMatch(/^A/)
  })

  it('leads the member from their own profile to the settings', async () => {
    const wrapper = await mountSuspended(PublicProfile, { props: { profile: { ...profile, bio: null }, own: true } })
    expect(wrapper.get('a[href="/settings"]').text()).toBe('Settings')
    expect(wrapper.text()).toContain("You haven't published any capture yet")
  })
})
