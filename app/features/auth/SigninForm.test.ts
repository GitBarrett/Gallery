import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { setResponseStatus, type H3Event } from 'h3'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, onMounted } from 'vue'
import SigninForm from './SigninForm.vue'

// The Turnstile check passes at once: the form only sees its token
const TurnstileCheck = defineComponent({
  name: 'TurnstileCheck',
  emits: ['update:modelValue'],
  setup(_, { emit, expose }) {
    onMounted(() => emit('update:modelValue', 'token'))
    expose({ reset: () => {} })
    return () => h('div', { 'data-turnstile': '' })
  },
})

let signin: (event: H3Event) => unknown
registerEndpoint('/api/auth/signin', { method: 'POST', handler: (event) => signin(event) })
const refuse = (status: number, code: string, details: unknown) => (event: H3Event) => {
  setResponseStatus(event, status)
  return { error: { code, message: code, details, correlationId: 'c' } }
}

async function submitted() {
  const wrapper = await mountSuspended(SigninForm, { global: { stubs: { TurnstileCheck } } })
  await wrapper.get('input[type="email"]').setValue('ash@example.com')
  await wrapper.get('input[type="password"]').setValue('a long passphrase')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  return wrapper
}

describe('SigninForm', () => {
  beforeEach(() => {
    signin = refuse(401, 'UNAUTHENTICATED', { reason: 'invalid_credentials' })
  })

  it('US-03.2 shows one message for wrong credentials, without the anti-bot check', async () => {
    const wrapper = await submitted()
    expect(wrapper.text()).toContain('Wrong email or password.')
    expect(wrapper.find('[data-turnstile]').exists()).toBe(false)
  })

  it('US-03.3 shows the anti-bot check once the server requires it', async () => {
    signin = refuse(400, 'VALIDATION_FAILED', { field: 'turnstileToken', reason: 'required' })
    const wrapper = await submitted()
    expect(wrapper.find('[data-turnstile]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Confirm you are not a robot')
  })

  it('US-03.3 says to wait when sign-in is blocked', async () => {
    signin = refuse(429, 'RATE_LIMITED', { retryAfterSeconds: 600 })
    const wrapper = await submitted()
    expect(wrapper.text()).toContain('Too many attempts')
  })
})
