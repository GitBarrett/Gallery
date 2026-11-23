import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { setResponseStatus, type H3Event } from 'h3'
import { describe, expect, it, vi } from 'vitest'
import ConfirmEmail from './ConfirmEmail.vue'

let confirm: (event: H3Event) => unknown = () => null
registerEndpoint('/api/auth/email/confirm', { method: 'POST', handler: (event) => confirm(event) })
registerEndpoint('/api/me', (event) => {
  setResponseStatus(event, 401)
  return { error: { code: 'UNAUTHENTICATED', message: 'x', correlationId: 'c' } }
})

async function open(hash: string) {
  window.history.replaceState(null, '', `/confirm-email${hash}`)
  return mountSuspended(ConfirmEmail)
}

describe('ConfirmEmail', () => {
  it('US-07.2 confirms the new email from the token of the fragment, then removes it from the address', async () => {
    const wrapper = await open('#secret-token')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Your new email is confirmed.'))
    expect(window.location.hash).toBe('')
    expect(wrapper.get('a').text()).toBe('Sign in')
  })

  it('US-07.2 explains an expired link or an address taken in the meantime', async () => {
    for (const [reason, text] of [
      ['expired', 'This link has expired.'],
      ['taken', 'This address is now used by another account.'],
    ]) {
      confirm = (event) => {
        setResponseStatus(event, 400)
        const details = { field: 'token', reason }
        return { error: { code: 'VALIDATION_FAILED', message: 'x', details, correlationId: 'c' } }
      }
      const wrapper = await open('#secret-token')
      await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain(text))
    }
  })
})
