import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { QUALITIES } from '../../../shared/domain/quality'
import { axeViolations } from '../../../tests/axe'
import QualityBadge from './QualityBadge.vue'

describe('UiQualityBadge', () => {
  it.each(QUALITIES)('US-75.5 always shows the %s tier name as text, not only its colour', async (quality) => {
    const wrapper = await mountSuspended(QualityBadge, { props: { quality, label: `Name of ${quality}` } })
    expect(wrapper.text()).toBe(`Name of ${quality}`)
    expect(wrapper.get('span').attributes('style')).toContain(`--tier: var(--quality-${quality})`)
  })

  it('has no serious accessibility violation', async () => {
    const wrapper = await mountSuspended(QualityBadge, { props: { quality: 'epic', label: 'Epic' } })
    expect(await axeViolations(wrapper.element)).toEqual([])
  })
})
