import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { readBody } from 'h3'
import ProfileForm from './ProfileForm.vue'

const sent = vi.fn()
registerEndpoint('/api/me', {
  method: 'PATCH',
  handler: async (event) => {
    sent(await readBody(event))
    return {
      id: '0190c3a0-0000-7000-8000-000000000001',
      username: 'Ash_Barrett',
      role: 'user',
      emailVerified: true,
      avatarUrl: null,
    }
  },
})

describe('ProfileForm', () => {
  it('US-07.1 saves the bio and the language, then says so', async () => {
    const wrapper = await mountSuspended(ProfileForm, { props: { username: 'Ash_Barrett', bio: 'Old bio' } })
    expect(wrapper.get('textarea').element.value).toBe('Old bio')
    expect(wrapper.get<HTMLInputElement>('input[value="en"]').element.checked).toBe(true)
    await wrapper.get('textarea').setValue('Night elf hunter.')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toBe('Profile saved.'))
    expect(sent).toHaveBeenCalledWith({ bio: 'Night elf hunter.', locale: 'en' })
  })

  it('US-07.1 shows the problem of a bio over 300 characters before sending', async () => {
    sent.mockClear()
    const wrapper = await mountSuspended(ProfileForm, { props: { username: 'Ash_Barrett', bio: null } })
    await wrapper.get('textarea').setValue('b'.repeat(301))
    expect(wrapper.text()).toContain('Your bio must have 300 characters or fewer.')
    await wrapper.get('form').trigger('submit')
    expect(sent).not.toHaveBeenCalled()
  })
})
