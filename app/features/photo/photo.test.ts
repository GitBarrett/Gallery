import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { setResponseStatus } from 'h3'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import { aPhoto } from '../../../tests/builders/captures'
import PhotoDetails from './PhotoDetails.vue'
import QualityBadgeTip from './QualityBadgeTip.vue'
import { usePhoto } from './usePhoto'

const features = { contests: false, follows: false, collections: false, leaderboard: false, ads: false }
registerEndpoint('/api/settings/public', () => ({
  qualityThresholds: { uncommon: 3, rare: 15, epic: 50, legendary: 150 },
  features: { ...features, donations: false, readonly: false, inviteOnly: true },
}))
registerEndpoint('/api/photos/0193a000-0000-7000-8000-0000000000c1', () => aPhoto())
registerEndpoint('/api/photos/0193a000-0000-7000-8000-0000000000c9', (event) => {
  setResponseStatus(event, 404)
  return { error: { code: 'NOT_FOUND', message: 'Not found', correlationId: 'c' } }
})

describe('usePhoto', () => {
  it('US-25.1 reads a published capture, and nothing for one that is not public', async () => {
    expect((await usePhoto('0193a000-0000-7000-8000-0000000000c1')).value).toEqual(aPhoto())
    expect((await usePhoto('0193a000-0000-7000-8000-0000000000c9')).value).toBeNull()
  })
})

describe('QualityBadgeTip', () => {
  it('US-71.2 tells the tier, its threshold and the likes missing for the next one', async () => {
    const tip = await mountSuspended(QualityBadgeTip, { props: { quality: 'rare', likes: 15 } })
    await expect.poll(() => tip.get('[role="tooltip"]').text()).toBe('Rare · 15+ likes · 35 likes to Epic')
    const button = tip.get('button')
    expect(button.attributes('aria-describedby')).toBe(tip.get('[role="tooltip"]').attributes('id'))
    await button.trigger('click') // a touch opens it
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(tip.get('[role="tooltip"]').classes()).toContain('open')
  })

  it('US-71.2 a new capture shows the likes to Uncommon, a Legendary one no next tier', async () => {
    const poor = await mountSuspended(QualityBadgeTip, { props: { quality: 'poor', likes: 1 } })
    await expect.poll(() => poor.get('[role="tooltip"]').text()).toBe('Poor · new capture · 2 likes to Uncommon')
    const top = await mountSuspended(QualityBadgeTip, { props: { quality: 'legendary', likes: 400 } })
    await expect.poll(() => top.get('[role="tooltip"]').text()).toBe('Legendary · 150+ likes')
    expect(await axeViolations(top.element)).toEqual([])
  })
})

describe('PhotoDetails', () => {
  it('US-25.1 shows the details of the capture as an item, only those it has', async () => {
    const details = await mountSuspended(PhotoDetails, {
      props: {
        photo: aPhoto({
          quality: 'epic',
          zone: { slug: 'nagrand', nameEn: 'Nagrand', nameFr: 'Nagrand' },
          inGameTime: '06:10',
          characterName: 'Ysolde',
          caption: '<b>First light.</b>',
          downloads: 12,
        }),
      },
    })
    const text = details.text()
    expect(text).toContain('Dawn on the Plains')
    expect(text).toContain('Epic capture · WoW Forever')
    expect(text).toContain('Nagrand · 06:10 in-game')
    expect(text).toContain('Character: Ysolde')
    expect(text).toContain('1920 × 1080 · PNG')
    expect(text).toContain('<b>First light.</b>') // author text as text
    expect(details.find('b').exists()).toBe(false)
    expect(text).toContain('Published November 25, 2026 · 12 downloads')
    const bare = await mountSuspended(PhotoDetails, { props: { photo: aPhoto({ downloads: 9 }) } })
    expect(bare.text()).not.toContain('downloads') // under 10, not shown (US-70.6)
    expect(bare.text()).not.toContain('Character')
    expect(await axeViolations(details.element)).toEqual([])
  })
})
