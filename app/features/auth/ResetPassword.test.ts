import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { readBody, setResponseStatus, type H3Event } from 'h3'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, onMounted } from 'vue'
import ResetPassword from './ResetPassword.vue'

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

let reset: (event: H3Event) => unknown
let forgotten: unknown[] = []
registerEndpoint('/api/auth/password/reset', { method: 'POST', handler: (event) => reset(event) })
registerEndpoint('/api/auth/password/forgot', {
  method: 'POST',
  handler: async (event) => (forgotten.push(await readBody(event)), null),
})
const refuse = (field: string, reason: string) => (event: H3Event) => {
  setResponseStatus(event, 400)
  return { error: { code: 'VALIDATION_FAILED', message: 'x', details: { field, reason }, correlationId: 'c' } }
}

async function opened(hash = '') {
  window.history.replaceState(null, '', `/reset${hash}`)
  const wrapper = await mountSuspended(ResetPassword, { global: { stubs: { TurnstileCheck } } })
  await flushPromises()
  return wrapper
}

async function submit(wrapper: Awaited<ReturnType<typeof opened>>, value: string) {
  await wrapper.get('input').setValue(value)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('ResetPassword', () => {
  beforeEach(() => {
    reset = refuse('token', 'expired')
    forgotten = []
  })

  it('US-04.1 asks for the email without a link, then answers the same whatever the email', async () => {
    const wrapper = await opened()
    expect(wrapper.text()).toContain('valid for 1 hour')
    await submit(wrapper, 'ash@example.com')
    expect(forgotten).toEqual([{ email: 'ash@example.com', turnstileToken: 'token' }])
    expect(wrapper.get('[role="status"]').text()).toContain('if this email is registered')
  })

  it('US-04.2 refuses an expired link, with a way to ask for a new one', async () => {
    const wrapper = await opened('#old-token')
    expect(window.location.hash).toBe('')
    await submit(wrapper, 'a new long passphrase')
    expect(wrapper.get('[role="alert"]').text()).toContain('This link has expired')
    await wrapper.get('button[type="button"]').trigger('click')
    expect(wrapper.text()).toContain('valid for 1 hour')
  })

  it('US-04.2 refuses a link already used', async () => {
    reset = refuse('token', 'invalid')
    const wrapper = await opened('#used-token')
    await submit(wrapper, 'a new long passphrase')
    expect(wrapper.get('[role="alert"]').text()).toContain('already used')
  })

  it('US-01.3 shows a refused password under its field, and keeps the form', async () => {
    reset = refuse('password', 'breached')
    const wrapper = await opened('#a-token')
    await submit(wrapper, 'password123456')
    expect(wrapper.text()).toContain('known data breach')
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
  })

  it('US-04.3 sends the token and the new password, then leaves the page signed in', async () => {
    let body: unknown
    reset = async (event) => ((body = await readBody(event)), null)
    const wrapper = await opened('#a-token')
    await submit(wrapper, 'a new long passphrase')
    expect(body).toEqual({ token: 'a-token', password: 'a new long passphrase' })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
