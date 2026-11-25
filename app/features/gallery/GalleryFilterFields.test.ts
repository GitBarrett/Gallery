import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import GalleryFilterFields from './GalleryFilterFields.vue'
import QualityHelp from './QualityHelp.vue'

registerEndpoint('/api/zones/suggest', () => ({
  zones: [{ slug: 'stormwind', nameEn: 'Stormwind City', nameFr: 'Hurlevent' }],
}))
const thresholds = { uncommon: 3, rare: 15, epic: 50, legendary: 150 }
afterEach(() => vi.useRealTimers())

describe('GalleryFilterFields', () => {
  it('US-20.3 emits each change of time of day, minimum quality and sort, keeping the other filters', async () => {
    const fields = await mountSuspended(GalleryFilterFields, {
      props: { filters: { zone: 'nagrand' }, thresholds },
    })
    const [time, sort] = fields.findAll('select')
    await time!.setValue('dusk')
    await sort!.setValue('popular')
    await fields
      .findAll('.tier')
      .find((b) => b.text() === 'Rare')!
      .trigger('click')
    expect(fields.emitted('change')).toEqual([
      [{ zone: 'nagrand', timeOfDay: 'dusk' }],
      [{ zone: 'nagrand', sort: 'popular' }],
      [{ zone: 'nagrand', minQuality: 'rare' }],
    ])
    await fields.setProps({ filters: { minQuality: 'rare' } })
    expect(fields.findAll('[aria-pressed="true"]').map((b) => b.text())).toEqual(['Rare'])
  })

  it('US-20.3 filters by a zone of the dictionary typed in its field', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const fields = await mountSuspended(GalleryFilterFields, { props: { filters: {}, thresholds } })
    const zone = fields.get<HTMLInputElement>('input[type="search"]')
    // Typed (input), the suggestions arrive, then committed (change), as in a browser
    zone.element.value = 'Stormwind City'
    await zone.trigger('input')
    await vi.advanceTimersByTimeAsync(300)
    await flushPromises()
    await zone.trigger('change')
    expect(fields.emitted('change')).toEqual([[{ zone: 'stormwind' }]])
  })

  it('has no serious accessibility violation', async () => {
    const fields = await mountSuspended(GalleryFilterFields, { props: { filters: {}, thresholds } })
    expect(await axeViolations(fields.element)).toEqual([])
  })
})

describe('QualityHelp', () => {
  it('US-71.1 lists the five tiers with the thresholds of the settings and links to how quality works', async () => {
    const help = await mountSuspended(QualityHelp, { props: { thresholds } })
    const button = help.get('button')
    expect(button.attributes('aria-expanded')).toBe('false')
    await button.trigger('click')
    expect(button.attributes('aria-expanded')).toBe('true')
    expect(help.findAll('.tier').map((tier) => tier.text())).toEqual([
      'Poornew capture',
      'Uncommon3 likes',
      'Rare15 likes',
      'Epic50 likes',
      'Legendary150 likes',
    ])
    expect(help.get('a').attributes('href')).toBe('/help/quality')
    await help.setProps({ thresholds: { ...thresholds, legendary: 1000 } }) // read, never written here
    expect(help.findAll('.tier').at(-1)!.text()).toBe('Legendary1,000 likes')
    expect(await axeViolations(help.element)).toEqual([])
  })
})
