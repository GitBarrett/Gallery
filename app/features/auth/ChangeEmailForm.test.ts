import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { readBody, setResponseStatus } from 'h3'
import ChangeEmailForm from './ChangeEmailForm.vue'

const prefs = { likes: true, comments: true, followers: true, contests: true }
let account = {
  email: 'ash@example.com' as string | null,
  hasPassword: true,
  providers: [] as string[],
  notificationPrefs: prefs,
}
const sent = vi.fn()
registerEndpoint('/api/me/account', () => account)
registerEndpoint('/api/me/email', {
  method: 'POST',
  handler: async (event) => {
    const body = await readBody(event)
    sent(body)
    if (account.hasPassword && body.currentPassword !== 'correct horse battery') {
      setResponseStatus(event, 400)
      const details = { field: 'currentPassword', reason: 'wrong' }
      return { error: { code: 'VALIDATION_FAILED', message: 'x', details, correlationId: 'c' } }
    }
    return null
  },
})

async function submit(newEmail: string, password?: string) {
  const wrapper = await mountSuspended(ChangeEmailForm)
  await vi.waitFor(() => expect(wrapper.find('form').exists()).toBe(true))
  const [email, current] = wrapper.findAll('input')
  await email!.setValue(newEmail)
  if (password !== undefined) await current!.setValue(password)
  await wrapper.get('form').trigger('submit')
  return wrapper
}

describe('ChangeEmailForm', () => {
  it('US-07.2 asks for the current password, then says the link went to the new address', async () => {
    const wrapper = await submit('ash.new@example.com', 'correct horse battery')
    expect(wrapper.text()).toContain('Your email: ash@example.com')
    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toContain('Link sent to ash.new@example.com'))
    expect(sent).toHaveBeenLastCalledWith({ newEmail: 'ash.new@example.com', currentPassword: 'correct horse battery' })
  })

  it('US-07.2 shows a wrong current password under its field', async () => {
    const wrapper = await submit('ash.new@example.com', 'not it')
    await vi.waitFor(() => expect(wrapper.text()).toContain('This is not your current password.'))
  })

  it('US-07.2 asks no password from an account without one, and adds a first email (Battle.net)', async () => {
    account = { email: null, hasPassword: false, providers: ['battlenet'], notificationPrefs: prefs }
    const wrapper = await submit('ash@example.com')
    expect(wrapper.findAll('input')).toHaveLength(1)
    expect(wrapper.text()).toContain('Your account has no email yet')
    await vi.waitFor(() => expect(wrapper.find('[role="status"]').exists()).toBe(true))
    expect(sent).toHaveBeenLastCalledWith({ newEmail: 'ash@example.com' })
  })
})
