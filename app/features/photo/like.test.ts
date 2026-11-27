import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { setResponseStatus } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import { aMe } from '../../../tests/builders/accounts'
import LikeButton from './LikeButton.vue'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
mockNuxtImport('navigateTo', () => navigate)

const ID = '0193a000-0000-7000-8000-0000000000e1'
let signedIn: string | null = 'Ash'
let state = { liked: false, likes: 11 }
registerEndpoint('/api/me', (event) => {
  if (signedIn) return aMe({ username: signedIn })
  setResponseStatus(event, 401)
  return { error: { code: 'UNAUTHENTICATED', message: 'x', correlationId: 'c' } }
})
registerEndpoint(`/api/photos/${ID}/like`, (event) => {
  if (event.method === 'PUT') state = { liked: true, likes: state.likes + 1 }
  if (event.method === 'DELETE') state = { liked: false, likes: state.likes - 1 }
  return state
})
afterEach(() => {
  navigate.mockClear()
  clearNuxtData('me')
})

const mount = (author = 'Brook') =>
  mountSuspended(LikeButton, { props: { photoId: ID, likes: 10, author }, route: `/p/${ID}` })

describe('LikeButton', () => {
  it('US-30.1 reads the member state, then likes and unlikes, the counter following', async () => {
    signedIn = 'Ash'
    state = { liked: false, likes: 11 }
    const like = await mount()
    const button = like.get('button')
    await vi.waitFor(() => expect(button.text()).toContain('11')) // the member's read, fresher than the page
    expect(button.attributes('aria-pressed')).toBe('false')
    await button.trigger('click')
    await flushPromises()
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.text()).toContain('12')
    await button.trigger('click')
    await flushPromises()
    expect(button.attributes('aria-pressed')).toBe('false')
    expect(button.text()).toContain('11')
    expect(await axeViolations(like.element)).toEqual([])
  })

  it('US-30.2 is disabled on their own capture, and says why', async () => {
    signedIn = 'Brook'
    const like = await mount('brook')
    expect(like.get('button').attributes('disabled')).toBeDefined()
    expect(like.text()).toContain("You can't like your own capture.")
  })

  it('US-30.4 invites a visitor to sign in, back to the page', async () => {
    signedIn = null
    const like = await mount()
    expect(like.get('button').text()).toContain('10')
    await like.get('button').trigger('click')
    expect(navigate).toHaveBeenCalledWith({ path: '/signin', query: { redirect: `/p/${ID}` } })
  })
})
