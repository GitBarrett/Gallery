import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import ItemTooltip from './ItemTooltip.vue'

const full = {
  title: 'Arcane Dusk',
  quality: 'epic' as const,
  use: 'Use: download the original as a wallpaper.',
  caption: '“The canals glow brighter than the stars.”',
  credit: 'Captured by @Lunelame',
}

describe('UiItemTooltip', () => {
  it('shows the title in the quality colour, the details, the Use line, the caption and the credit', async () => {
    const wrapper = await mountSuspended(ItemTooltip, {
      props: full,
      slots: { default: () => 'Epic capture · WoW Forever' },
    })
    expect(wrapper.get('.title').text()).toBe('Arcane Dusk')
    expect(wrapper.attributes('style')).toContain('--tier: var(--quality-epic)')
    expect(wrapper.get('.details').text()).toBe('Epic capture · WoW Forever')
    expect(wrapper.get('.use').text()).toBe(full.use)
    expect(wrapper.get('.caption').text()).toBe(full.caption)
    expect(wrapper.get('.credit').text()).toBe(full.credit)
  })

  it('leaves out the optional lines that are not given', async () => {
    const wrapper = await mountSuspended(ItemTooltip, { props: { title: 'Snowy pass', quality: 'poor' } })
    expect(wrapper.findAll('.details, .use, .caption, .credit')).toHaveLength(0)
  })

  it('has no serious accessibility violation', async () => {
    const wrapper = await mountSuspended(ItemTooltip, { props: full, slots: { default: () => 'Suramar' } })
    expect(await axeViolations(wrapper.element)).toEqual([])
  })
})
