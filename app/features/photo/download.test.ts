import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { setResponseStatus } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import DownloadButton from './DownloadButton.vue'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
mockNuxtImport('navigateTo', () => navigate)
afterEach(() => navigate.mockClear())

const ID = '0193a000-0000-7000-8000-0000000000d1'
const URL_OF = 'https://acc.r2.cloudflarestorage.com/ls/originals/0193?X-Amz-Signature=0'
let answer: 'ok' | 'visitor' | 'limited' = 'ok'
let asked = 0
registerEndpoint(`/api/photos/${ID}/download`, {
  method: 'POST',
  handler: (event) => {
    asked++
    if (answer === 'visitor') {
      setResponseStatus(event, 401)
      return { error: { code: 'UNAUTHENTICATED', message: 'Sign in', correlationId: 'c' } }
    }
    if (answer === 'limited') {
      setResponseStatus(event, 429)
      return { error: { code: 'RATE_LIMITED', message: 'Too many requests', correlationId: 'c' } }
    }
    return { url: URL_OF, expiresAt: '2026-11-26T20:05:00.000Z' }
  },
})

const mount = (route = `/p/${ID}`) =>
  mountSuspended(DownloadButton, { props: { photoId: ID, bytes: 9_400_000 }, route })

describe('DownloadButton', () => {
  it('US-23.1 opens the signed URL of the original, the size of the file on the button', async () => {
    answer = 'ok'
    const button = await mount()
    expect(button.text()).toContain('Download original · 9.4 MB')
    await button.get('button').trigger('click')
    await flushPromises()
    expect(navigate).toHaveBeenCalledWith(URL_OF, { external: true })
    expect(await axeViolations(button.element)).toEqual([])
  })

  it('US-23.2 sends a visitor to sign in, back to the page to download', async () => {
    answer = 'visitor'
    const button = await mount()
    await button.get('button').trigger('click')
    await flushPromises()
    expect(navigate).toHaveBeenCalledWith({ path: '/signin', query: { redirect: `/p/${ID}?download=1` } })
  })

  it('US-23.2 back from the sign-in, the download starts once and the URL forgets it', async () => {
    answer = 'ok'
    const before = asked
    await mount(`/p/${ID}?download=1&from=home`)
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith(URL_OF, { external: true }))
    expect(navigate).toHaveBeenCalledWith({ query: { from: 'home' } }, { replace: true })
    expect(asked).toBe(before + 1)
  })

  it('US-23.3 tells a member past the limit to wait', async () => {
    answer = 'limited'
    const button = await mount()
    await button.get('button').trigger('click')
    await flushPromises()
    expect(button.get('[role="alert"]').text()).toBe('Too many attempts. Wait a moment and try again.')
    expect(navigate).not.toHaveBeenCalled()
  })
})
