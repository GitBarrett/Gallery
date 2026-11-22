import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { readBody, setResponseStatus, type H3Event } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OAuthComplete from './OAuthComplete.vue'

let pending: (event: H3Event) => unknown
let complete: (event: H3Event) => unknown
let sent: unknown
registerEndpoint('/api/auth/oauth/pending', { method: 'GET', handler: (event) => pending(event) })
registerEndpoint('/api/auth/oauth/complete', {
  method: 'POST',
  handler: async (event) => {
    sent = await readBody(event)
    return complete(event)
  },
})
const refuse = (status: number, code: string, details?: unknown) => (event: H3Event) => {
  setResponseStatus(event, status)
  return { error: { code, message: code, details, correlationId: 'c' } }
}
const identity = { provider: 'google', email: 'ash@gmail.com', emailTaken: false }

async function mounted() {
  const wrapper = await mountSuspended(OAuthComplete)
  await flushPromises()
  return wrapper
}

describe('OAuthComplete', () => {
  beforeEach(() => {
    clearNuxtData('oauth-pending')
    pending = () => identity
    complete = () => null
    sent = undefined
  })

  it('US-02.1 asks for a username and the Terms, then creates the account', async () => {
    const wrapper = await mounted()
    expect(wrapper.get('h1').text()).toBe('Choose your username')
    expect(wrapper.find('input[type="checkbox"][required]').exists()).toBe(true)
    await wrapper.get('input[autocomplete="username"]').setValue('Ash_Barrett')
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(sent).toEqual({ username: 'Ash_Barrett', termsAccepted: true, locale: 'en' })
  })

  it('US-02.1 shows a username already taken under its field', async () => {
    complete = refuse(409, 'CONFLICT', { field: 'username' })
    const wrapper = await mounted()
    await wrapper.get('input[autocomplete="username"]').setValue('Ash_Barrett')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.text()).toContain('This username is already taken.'))
  })

  it('US-02.3 sends the owner of an existing email to sign in to link, with no new account', async () => {
    pending = () => ({ ...identity, emailTaken: true })
    const wrapper = await mounted()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.text()).toContain('An account already uses ash@gmail.com.')
    expect(wrapper.get('a[href="/signin?link=google"]').text()).toBe('Sign in to link Google')
  })

  it('says when the sign-in in progress has expired', async () => {
    pending = refuse(404, 'NOT_FOUND')
    const wrapper = await mounted()
    expect(wrapper.get('[role="alert"]').text()).toContain('This sign-in has expired')
    expect(wrapper.find('a[href="/signin"]').exists()).toBe(true)
  })
})
