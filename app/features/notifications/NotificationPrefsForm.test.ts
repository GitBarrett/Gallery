import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { readBody } from 'h3'
import { axeViolations } from '../../../tests/axe'
import { aMe } from '../../../tests/builders/accounts'
import NotificationPrefsForm from './NotificationPrefsForm.vue'

const sent: unknown[] = []
registerEndpoint('/api/me/account', () => ({
  email: 'ash@example.com',
  hasPassword: true,
  providers: [],
  notificationPrefs: { likes: true, comments: false, followers: true, contests: true },
}))
registerEndpoint('/api/me', {
  method: 'PATCH',
  handler: async (event) => {
    sent.push(await readBody(event))
    return aMe()
  },
})

describe('NotificationPrefsForm', () => {
  it('US-07.5 shows the saved preferences and saves a change at once; moderation stays on', async () => {
    const wrapper = await mountSuspended(NotificationPrefsForm)
    await vi.waitFor(() => expect(wrapper.findAll('input')).toHaveLength(5))
    const boxes = wrapper.findAll<HTMLInputElement>('input')
    expect(boxes.map((b) => b.element.checked)).toEqual([true, false, true, true, true])
    expect(boxes[4]!.element.disabled).toBe(true)

    await boxes[0]!.setValue(false)
    await vi.waitFor(() => expect(wrapper.get('[role="status"]').text()).toBe('Saved'))
    expect(sent).toEqual([{ notificationPrefs: { likes: false } }])
    expect(await axeViolations(wrapper.element)).toEqual([])
  })
})
