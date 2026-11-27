import { mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import ShareButton from './ShareButton.vue'

const ID = '0193a000-0000-7000-8000-0000000000a9'
const mount = () => mountSuspended(ShareButton, { props: { photoId: ID, title: 'Moonlit Path' } })
afterEach(() => vi.unstubAllGlobals())

describe('ShareButton', () => {
  it('US-32.1 opens the native share sheet with the link of the page when the browser has one', async () => {
    const share = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, share })
    const button = await mount()
    await button.get('button').trigger('click')
    await flushPromises()
    expect(share).toHaveBeenCalledWith({ title: 'Moonlit Path', url: expect.stringMatching(new RegExp(`/p/${ID}$`)) })
    expect(button.get('ul').attributes('style')).toContain('display: none') // no menu
  })

  it('US-32.1 otherwise offers to copy the link, X, Facebook, Reddit and Discord', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText } })
    const button = await mount()
    await button.get('button').trigger('click')
    expect(button.get('button').attributes('aria-expanded')).toBe('true')
    expect(button.findAll('li').map((li) => li.text())).toEqual([
      'Copy link',
      'X',
      'Facebook',
      'Reddit',
      'Discord (copy the link)',
    ])
    const x = button.findAll('a')[0]!
    expect(x.attributes('href')).toContain(encodeURIComponent(`/p/${ID}`))
    expect(x.attributes('rel')).toBe('noopener noreferrer')
    await button.findAll('li button')[0]!.trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(expect.stringMatching(new RegExp(`/p/${ID}$`)))
    expect(button.get('[role="status"]').text()).toBe('Link copied')
    expect(await axeViolations(button.element)).toEqual([])
  })
})
