import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { readBody, setResponseStatus } from 'h3'
import ChangePasswordForm from './ChangePasswordForm.vue'

registerEndpoint('/api/me/password', {
  method: 'POST',
  handler: async (event) => {
    const { currentPassword, password } = await readBody(event)
    const refuse = (field: string, reason: string) => {
      setResponseStatus(event, 400)
      return { error: { code: 'VALIDATION_FAILED', message: 'x', details: { field, reason }, correlationId: 'c' } }
    }
    if (currentPassword !== 'correct horse battery') return refuse('currentPassword', 'wrong')
    if (password === 'password1234') return refuse('password', 'breached')
    return null
  },
})

async function submit(currentPassword: string, password: string) {
  const wrapper = await mountSuspended(ChangePasswordForm)
  const [current, next] = wrapper.findAll('input')
  await current!.setValue(currentPassword)
  await next!.setValue(password)
  await wrapper.get('form').trigger('submit')
  return wrapper
}

describe('ChangePasswordForm', () => {
  it('US-07.3 changes the password, says the other devices are signed out and empties the fields', async () => {
    const wrapper = await submit('correct horse battery', 'a new passphrase')
    await vi.waitFor(() =>
      expect(wrapper.get('[role="status"]').text()).toBe('Password changed. Your other devices are signed out.'),
    )
    expect(wrapper.emitted('changed')).toHaveLength(1)
    expect(wrapper.findAll('input').map((i) => i.element.value)).toEqual(['', ''])
  })

  it('US-07.3 shows a wrong old password and a breached new one, and changes nothing', async () => {
    const wrong = await submit('not it', 'a new passphrase')
    await vi.waitFor(() => expect(wrong.text()).toContain('This is not your current password.'))
    const breached = await submit('correct horse battery', 'password1234')
    await vi.waitFor(() => expect(breached.text()).toContain('This password appeared in a known data breach.'))
    expect(wrong.emitted('changed') ?? breached.emitted('changed')).toBeUndefined()
  })
})
