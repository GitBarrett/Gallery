import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { setResponseStatus, type H3Event } from 'h3'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, onMounted } from 'vue'
import { aMe } from '../../../tests/builders/accounts'
import VerifyEmail from './VerifyEmail.vue'

// The Turnstile check passes at once: the form only sees its token
const TurnstileCheck = defineComponent({
  name: 'TurnstileCheck',
  emits: ['update:modelValue'],
  setup(_, { emit, expose }) {
    onMounted(() => emit('update:modelValue', 'token'))
    expose({ reset: () => {} })
    return () => h('div')
  },
})

let verify: (event: H3Event) => unknown
let signedIn = false
let resent = 0
registerEndpoint('/api/auth/verify-email', { method: 'POST', handler: (event) => verify(event) })
registerEndpoint('/api/auth/resend-verification', { method: 'POST', handler: () => (resent++, null) })
registerEndpoint('/api/me', (event) => {
  if (signedIn) return aMe({ username: 'ash', emailVerified: false })
  setResponseStatus(event, 401)
  return { error: { code: 'UNAUTHENTICATED', message: 'x', correlationId: 'c' } }
})
const refuse = (reason: string) => (event: H3Event) => {
  setResponseStatus(event, 400)
  return { error: { code: 'VALIDATION_FAILED', message: 'x', details: { field: 'token', reason }, correlationId: 'c' } }
}

async function opened(hash: string) {
  window.history.replaceState(null, '', `/verify-email${hash}`)
  const wrapper = await mountSuspended(VerifyEmail, { global: { stubs: { TurnstileCheck } } })
  await flushPromises()
  return wrapper
}

describe('VerifyEmail', () => {
  beforeEach(() => {
    verify = refuse('expired')
    signedIn = false
    resent = 0
  })

  it('US-01.4 removes the token from the address bar once read', async () => {
    verify = () => null
    await opened('#a-token')
    expect(window.location.hash).toBe('')
  })

  it('US-01.5 offers "Resend" on an expired link, and sends a new one', async () => {
    signedIn = true
    await refreshNuxtData('me')
    const wrapper = await opened('#old-token')
    expect(wrapper.text()).toContain('This link has expired')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(resent).toBe(1)
    expect(wrapper.text()).toContain('New link sent')
  })

  it('US-01.5 asks a visitor to sign in to get a new link', async () => {
    await refreshNuxtData('me')
    const wrapper = await opened('#old-token')
    expect(wrapper.get('a[href^="/signin"]').text()).toBe('Sign in to get a new link')
  })

  it('US-01.4 says when a link was already used or is wrong', async () => {
    verify = refuse('invalid')
    const wrapper = await opened('#used-token')
    expect(wrapper.text()).toContain('This link is not valid')
  })
})
