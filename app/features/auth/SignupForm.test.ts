import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { setResponseStatus, type H3Event } from 'h3'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, onMounted } from 'vue'
import SignupForm from './SignupForm.vue'

// The Turnstile check passes at once: the forms only see its token
const TurnstileCheck = defineComponent({
  name: 'TurnstileCheck',
  emits: ['update:modelValue'],
  setup(_, { emit, expose }) {
    onMounted(() => emit('update:modelValue', 'token'))
    expose({ reset: () => {} })
    return () => h('div')
  },
})

let signup: (event: H3Event) => unknown
registerEndpoint('/api/auth/signup', { method: 'POST', handler: (event) => signup(event) })
registerEndpoint('/api/waitlist', { method: 'POST', handler: () => null })
const refuse = (status: number, code: string, details: unknown) => (event: H3Event) => {
  setResponseStatus(event, status)
  return { error: { code, message: code, details, correlationId: 'c' } }
}

async function submitted(password = 'a long passphrase') {
  const wrapper = await mountSuspended(SignupForm, { global: { stubs: { TurnstileCheck } } })
  const inputs = wrapper.findAll('input')
  await inputs[0]!.setValue('Ash_Barrett')
  await inputs[1]!.setValue('ash@example.com')
  await inputs[2]!.setValue(password)
  await inputs[3]!.setValue(true)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
  return wrapper
}

describe('SignupForm', () => {
  beforeEach(() => {
    signup = () => null
  })

  it('US-01.1 ends on "Check your inbox" once the sign-up is accepted', async () => {
    const wrapper = await submitted()
    expect(wrapper.get('h1').text()).toBe('Check your inbox')
  })

  it('US-01.3 shows a breached password under its field and keeps the form', async () => {
    signup = refuse(400, 'VALIDATION_FAILED', { field: 'password', reason: 'breached' })
    const wrapper = await submitted()
    expect(wrapper.text()).toContain('This password appeared in a known data breach')
    expect(wrapper.get('h1').text()).toBe('Create account')
  })

  it('checks the password rule before sending', async () => {
    signup = () => {
      throw new Error('must not be sent')
    }
    const wrapper = await submitted('short')
    expect(wrapper.text()).toContain('Your password must have at least 10 characters.')
  })

  it('US-56.4 opens the waiting list with the email when the beta refuses the sign-up', async () => {
    signup = refuse(403, 'FORBIDDEN', { reason: 'invite_required' })
    const wrapper = await submitted()
    expect(wrapper.get('h1').text()).toBe('Join the waiting list')
    const inputs = wrapper.findAll('input')
    expect((inputs[0]!.element as HTMLInputElement).value).toBe('ash@example.com')
    await inputs[1]!.setValue(true)
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe("You're on the list")
  })
})
