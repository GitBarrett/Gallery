import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { setResponseStatus } from 'h3'
import LinkedAccounts from './LinkedAccounts.vue'

registerEndpoint('/api/me/account', () => ({
  email: 'ash@example.com',
  hasPassword: false,
  providers: ['google', 'battlenet'],
  notificationPrefs: { likes: true, comments: true, followers: true, contests: true },
}))
let lastMethod = false
registerEndpoint('/api/me/oauth/battlenet', { method: 'DELETE', handler: () => null })
registerEndpoint('/api/me/oauth/google', {
  method: 'DELETE',
  handler: (event) => {
    if (!lastMethod) return null
    setResponseStatus(event, 403)
    const details = { reason: 'last_sign_in_method' }
    return { error: { code: 'FORBIDDEN', message: 'x', details, correlationId: 'c' } }
  },
})

describe('LinkedAccounts', () => {
  it('US-07.4 lists the linked providers and unlinks one', async () => {
    const wrapper = await mountSuspended(LinkedAccounts)
    await vi.waitFor(() => expect(wrapper.findAll('button')).toHaveLength(2))
    await wrapper.get('button[aria-label="Unlink Battle.net"]').trigger('click')
    await vi.waitFor(() =>
      expect(wrapper.get('[role="status"]').text()).toBe('Battle.net is no longer linked to your account.'),
    )
    expect(wrapper.text()).toContain('Not linked')
  })

  it('US-07.4 explains why the last way to sign in cannot be unlinked', async () => {
    lastMethod = true
    const wrapper = await mountSuspended(LinkedAccounts)
    await vi.waitFor(() => expect(wrapper.find('button[aria-label="Unlink Google"]').exists()).toBe(true))
    await wrapper.get('button[aria-label="Unlink Google"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.get('[role="alert"]').text()).toContain('This is your only way to sign in'))
  })
})
