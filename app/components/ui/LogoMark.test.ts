import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import LogoMark from './LogoMark.vue'

describe('UiLogoMark', () => {
  it('shows the emblem and the wordmark, the emblem being decorative', async () => {
    const wrapper = await mountSuspended(LogoMark)
    expect(wrapper.get('img').attributes('alt')).toBe('')
    expect(wrapper.text()).toBe('Legendary Shots')
  })

  it('names the emblem when shown alone (mobile header)', async () => {
    const wrapper = await mountSuspended(LogoMark, { props: { compact: true } })
    expect(wrapper.get('img').attributes('alt')).toBe('Legendary Shots')
    expect(wrapper.text()).toBe('')
  })

  it('has no serious accessibility violation in both forms', async () => {
    for (const compact of [false, true]) {
      const wrapper = await mountSuspended(LogoMark, { props: { compact } })
      expect(await axeViolations(wrapper.element)).toEqual([])
    }
  })
})
