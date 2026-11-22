import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { setResponseStatus } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SessionList from './SessionList.vue'

const at = '2026-11-22T12:00:00.000Z'
const session = (id: string, current: boolean, browser: string | null, os: string | null) => ({
  id: id.repeat(64),
  device: { browser, os },
  createdAt: at,
  lastSeenAt: at,
  current,
})
let sessions: ReturnType<typeof session>[]
const calls: string[] = []

registerEndpoint('/api/me/sessions', () => ({ sessions }))
registerEndpoint(`/api/me/sessions/${'b'.repeat(64)}`, {
  method: 'DELETE',
  handler: () => {
    calls.push('revoke b')
    sessions = sessions.filter((s) => s.id !== 'b'.repeat(64))
    return null
  },
})
registerEndpoint('/api/me/sessions/revoke-others', {
  method: 'POST',
  handler: (event) => {
    calls.push('revoke others')
    setResponseStatus(event, 500)
    return { error: { code: 'INTERNAL', message: 'x', correlationId: 'c' } }
  },
})

async function mounted() {
  const wrapper = await mountSuspended(SessionList)
  await vi.waitFor(() => expect(wrapper.find('li').exists()).toBe(true))
  return wrapper
}

describe('SessionList', () => {
  beforeEach(() => {
    calls.length = 0
    sessions = [
      session('a', true, 'Firefox', 'Linux'),
      session('b', false, 'Safari', null),
      session('c', false, null, null),
    ]
  })

  it('US-03.7 shows each device readably and marks the current one without a revoke button', async () => {
    const items = (await mounted()).findAll('li')
    expect(items.map((li) => li.find('.name').text())).toEqual([
      'Firefox on Linux This device',
      'Safari',
      'Unknown device',
    ])
    expect(items[0]!.find('button').exists()).toBe(false)
    expect(items[1]!.get('button').attributes('aria-label')).toBe('Sign out Safari')
  })

  it('US-03.8 revokes another session and reloads the list', async () => {
    const wrapper = await mounted()
    await wrapper.findAll('li')[1]!.get('button').trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('li')).toHaveLength(2))
    expect(calls).toEqual(['revoke b'])
  })

  it('US-03.9 offers to revoke all other sessions and shows a failure', async () => {
    const wrapper = await mounted()
    await wrapper.get('section > button').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(calls).toEqual(['revoke others'])
    expect(wrapper.get('[role="alert"]').text()).not.toBe('')
  })

  it('offers no bulk revoke with a single session', async () => {
    sessions = [session('a', true, null, 'iOS')]
    const wrapper = await mounted()
    expect(wrapper.find('section > button').exists()).toBe(false)
    expect(wrapper.get('.name').text()).toBe('iOS This device')
  })
})
