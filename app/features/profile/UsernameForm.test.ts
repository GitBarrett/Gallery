import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { setResponseStatus, type H3Event } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import UsernameForm from './UsernameForm.vue'

let update: (event: H3Event) => unknown
registerEndpoint('/api/me', { method: 'PATCH', handler: (event) => update(event) })
registerEndpoint('/api/usernames/Kaelys/availability', () => ({ available: false, reason: 'taken' }))
registerEndpoint('/api/usernames/Thrall_Fan/availability', () => ({ available: true }))
const refuse = (status: number, code: string, details: unknown) => (event: H3Event) => {
  setResponseStatus(event, status)
  return { error: { code, message: code, details, correlationId: 'c' } }
}

const mount = () => mountSuspended(UsernameForm, { props: { username: 'Ash_Barrett' } })

async function typed(name: string) {
  const wrapper = await mount()
  await wrapper.get('input').setValue(name)
  await vi.advanceTimersByTimeAsync(300)
  await flushPromises()
  return wrapper
}

describe('UsernameForm', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    update = () => ({
      id: '0194b0d4-0000-7000-8000-000000000000',
      username: 'Thrall_Fan',
      role: 'user',
      emailVerified: true,
    })
  })
  afterEach(() => vi.useRealTimers())

  it('US-05.2 shows at once why a username cannot be used, without asking the server for a malformed one', async () => {
    const taken = await typed('Kaelys')
    await vi.waitFor(() => expect(taken.get('input').attributes('aria-invalid')).toBe('true'))
    expect(taken.text()).toContain('This username is already taken.')
    expect((await typed('admin')).text()).toContain('This username is reserved. Choose another one.')
    const free = await typed('Thrall_Fan')
    expect(free.get('input').attributes('aria-invalid')).toBeUndefined()
    await vi.waitFor(() => expect(free.text()).toContain('“Thrall_Fan” is available'))
  })

  it('US-05.1 saves the new username and says so', async () => {
    const wrapper = await typed('Thrall_Fan')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toBe(
      'Username changed. Your former profile link redirects for 90 days.',
    )
  })

  it('US-05.4 says when the username can change again', async () => {
    update = refuse(429, 'RATE_LIMITED', { retryAfterSeconds: 12 * 86_400 })
    const wrapper = await typed('Thrall_Fan')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe(
      'You can change your username once every 30 days: try again in 12 days.',
    )
  })
})
