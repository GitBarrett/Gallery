import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import type { NotificationItem } from '~~/shared/contracts/notifications'
import QuestLog from './QuestLog.vue'
import { useUnread } from './useUnread'

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
const base = { actor: null, others: 0, photoId: null, photoTitle: null, detail: null, read: false }
const photo = '0193a000-0000-7000-8000-000000000001'
const item = (id: number, fields: Partial<NotificationItem>): NotificationItem => ({
  ...base,
  type: 'follow',
  id: `0193a000-0000-7000-8000-00000000010${id}`,
  createdAt: new Date(Math.max(Date.now() - 60_000, startOfToday)).toISOString(), // today, even just after midnight
  ...fields,
})
const listed = [
  item(1, { type: 'like', actor: 'Ysolde', others: 23, photoId: photo, photoTitle: 'Dawn on the Plains' }),
  item(2, { type: 'quality', photoId: photo, photoTitle: 'Dawn on the Plains', detail: 'epic', read: true }),
  item(3, { type: 'follow', actor: 'Valdren', createdAt: hoursAgo(48) }),
  item(4, { type: 'moderation', detail: 'rejected', createdAt: hoursAgo(72), read: true }),
]
const marked: string[] = []
registerEndpoint('/api/notifications', () => ({ notifications: listed }))
registerEndpoint('/api/notifications/read-all', { method: 'POST', handler: () => marked.push('all') && null })
registerEndpoint(`/api/notifications/${listed[0]!.id}/read`, {
  method: 'POST',
  handler: () => marked.push(listed[0]!.id) && null,
})

async function mount() {
  const wrapper = await mountSuspended(QuestLog)
  await vi.waitFor(() => expect(wrapper.findAll('li')).toHaveLength(4))
  return wrapper
}

describe('QuestLog', () => {
  it('US-35.3 groups Today / Earlier, unread with a yellow marker, read in grey, with the texts of now', async () => {
    const wrapper = await mount()
    expect(wrapper.findAll('h2').map((h) => h.text())).toEqual(['Today', 'Earlier'])
    const rows = wrapper.findAll('li')
    expect(rows.map((r) => r.get('p').text())).toEqual([
      'Ysolde and 23 others liked “Dawn on the Plains”.',
      'Your capture “Dawn on the Plains” reached Epic quality.',
      'Valdren started following you.',
      'Your new avatar was rejected by moderation.',
    ])
    expect(rows.map((r) => r.classes().includes('unread'))).toEqual([true, false, true, false])
    expect(rows.map((r) => r.get('svg').attributes('aria-label'))).toEqual(['Unread', 'Read', 'Unread', 'Read'])
    expect(rows.map((r) => r.get('a').attributes('href'))).toEqual([
      `/p/${photo}`,
      `/p/${photo}`,
      '/u/Valdren',
      '/settings',
    ])
    expect(rows[2]!.get('time').text()).toBe('2 days ago')
    expect(await axeViolations(wrapper.element)).toEqual([])
  })

  it('US-35.3 marks an entry read when its link is followed, and lowers the bell', async () => {
    const wrapper = await mount()
    useUnread().value = 2
    await wrapper.findAll('li')[0]!.get('a').trigger('click')
    expect(wrapper.findAll('li')[0]!.classes()).not.toContain('unread')
    expect(useUnread().value).toBe(1)
    await vi.waitFor(() => expect(marked).toContain(listed[0]!.id))
  })

  it('US-35.3 filters the unread, then « Mark all as read » greys them all and empties the bell', async () => {
    const wrapper = await mount()
    const [all, unreadTab, markAll] = wrapper.findAll('button')
    await unreadTab!.trigger('click')
    expect(unreadTab!.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('li')).toHaveLength(2)
    await all!.trigger('click')
    useUnread().value = 2
    await markAll!.trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('li.unread')).toHaveLength(0))
    expect(marked).toContain('all')
    expect(useUnread().value).toBe(0)
    await unreadTab!.trigger('click')
    expect(wrapper.text()).toContain('No new quests. Go capture something beautiful.')
  })
})
