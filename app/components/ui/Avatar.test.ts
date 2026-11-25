import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import Avatar from './Avatar.vue'

const src = '/avatar/0193a000-0000-7000-8000-0000000000a1/0193a000-0000-7000-8000-0000000000b2'

describe('UiAvatar', () => {
  it('US-07.6 shows the square WebP at 64, 128 or 256 px, decorative', async () => {
    const wrapper = await mountSuspended(Avatar, { props: { src, name: 'Ash', size: 'lg' } })
    const img = wrapper.get('img')
    expect(img.attributes('src')).toBe(`${src}/256`)
    expect(img.attributes('srcset')).toBe(`${src}/64 64w, ${src}/128 128w, ${src}/256 256w`)
    expect(img.attributes('alt')).toBe('')
  })

  it('US-05.3 shows the initial without an avatar, or when it fails to load', async () => {
    const none = await mountSuspended(Avatar, { props: { src: null, name: 'ash' } })
    expect(none.find('img').exists()).toBe(false)
    expect(none.text()).toBe('A')
    const broken = await mountSuspended(Avatar, { props: { src, name: 'Ash' } })
    await broken.get('img').trigger('error')
    expect(broken.text()).toBe('A')
  })

  it('has no serious accessibility violation', async () => {
    for (const props of [
      { src, name: 'Ash' },
      { src: null, name: 'Ash' },
    ]) {
      const wrapper = await mountSuspended(Avatar, { props })
      expect(await axeViolations(wrapper.element)).toEqual([])
    }
  })
})
