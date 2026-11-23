import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import SocialLinks from './SocialLinks.vue'

const links = [
  { platform: 'twitch' as const, label: 'Ash_Barrett', url: 'https://twitch.tv/Ash_Barrett' },
  { platform: 'website' as const, label: 'ash.example.com', url: 'https://ash.example.com/shots' },
  { platform: 'discord' as const, label: 'ash.barrett', url: null },
]

describe('SocialLinks', () => {
  it('US-82.4 links each network with the URL built by the server, opened apart and without trust', async () => {
    const wrapper = await mountSuspended(SocialLinks, { props: { links } })
    const anchors = wrapper.findAll('a')
    expect(anchors.map((a) => a.attributes('href'))).toEqual([
      'https://twitch.tv/Ash_Barrett',
      'https://ash.example.com/shots',
    ])
    for (const a of anchors) {
      expect(a.attributes('rel')).toBe('nofollow ugc noopener noreferrer')
      expect(a.attributes('target')).toBe('_blank')
      expect(a.find('svg').exists()).toBe(true)
    }
    expect(anchors[0]!.attributes('aria-label')).toBe('Twitch: Ash_Barrett')
    expect(anchors[1]!.text()).toBe('ash.example.com') // a website shows its domain only
  })

  it('US-82.4 gives Discord no link: a button copies the username', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const wrapper = await mountSuspended(SocialLinks, { props: { links } })
    const button = wrapper.get('button')
    expect(button.attributes('aria-label')).toBe('Copy the Discord username ash.barrett')
    await button.trigger('click')
    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toBe('Discord username copied'))
    expect(writeText).toHaveBeenCalledWith('ash.barrett')
    vi.unstubAllGlobals()
  })

  it('shows nothing without links', async () => {
    const wrapper = await mountSuspended(SocialLinks, { props: { links: [] } })
    expect(wrapper.find('ul').exists()).toBe(false)
  })
})
