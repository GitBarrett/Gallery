import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { getQuery } from 'h3'
import { axeViolations } from '../../../tests/axe'
import MyCaptures from './MyCaptures.vue'

const id = (n: number) => `0193a000-0000-7000-8000-${String(n).padStart(12, '0')}`
const capture = (n: number, status: string, title: string | null = `Capture ${n}`) => ({
  id: id(n),
  title,
  status,
  width: 1920,
  height: 1080,
  uploadedAt: '2026-11-25T10:00:00.000Z',
})
const first = ['published', 'pending_review', 'rejected', 'processing', 'failed', 'hidden'].map((s, i) =>
  capture(i + 1, s),
)
const deleted: string[] = []
registerEndpoint(`/api/photos/${id(1)}`, {
  method: 'DELETE',
  handler: () => {
    deleted.push(id(1))
    return null
  },
})
registerEndpoint('/api/me/photos', (event) =>
  getQuery(event).cursor === id(6)
    ? { items: [capture(7, 'published', null)], nextCursor: null }
    : { items: first, nextCursor: id(6) },
)

describe('MyCaptures', () => {
  it('US-14.4 lists every status in words, the unpublished images through the private preview', async () => {
    const wrapper = await mountSuspended(MyCaptures, { props: { username: 'Lunelame' } })
    await vi.waitFor(() => expect(wrapper.findAll('li')).toHaveLength(6))
    const cards = wrapper.findAll('li')
    expect(cards.map((c) => c.get('.status').text())).toEqual([
      'Published',
      'In review',
      'Rejected',
      'Processing',
      'Processing failed',
      'Hidden',
    ])
    // Variants exist for published, in review and hidden only; the others show a frame of their size
    expect(cards.map((c) => (c.find('img').exists() ? c.get('img').attributes('src') : null))).toEqual([
      `/img/${id(1)}/1200`,
      `/img/${id(2)}/1200?preview=1`,
      null,
      null,
      null,
      `/img/${id(6)}/1200?preview=1`,
    ])
    expect(cards[4]!.text()).toContain('Please upload it again')
    expect(await axeViolations(wrapper.element)).toEqual([])
  })

  it('US-75.3 describes each image with its title and its author', async () => {
    const wrapper = await mountSuspended(MyCaptures, { props: { username: 'Lunelame' } })
    await vi.waitFor(() => expect(wrapper.find('img').exists()).toBe(true))
    expect(wrapper.get('img').attributes()).toMatchObject({ alt: 'Capture 1, captured by Lunelame', width: '1920' })
  })

  it('US-14.4 loads the next page, then hides the button', async () => {
    const wrapper = await mountSuspended(MyCaptures, { props: { username: 'Lunelame' } })
    await vi.waitFor(() => expect(wrapper.findAll('li')).toHaveLength(6))
    const more = () => wrapper.findAll('button').find((b) => b.text() === 'Load more captures')
    await more()!.trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('li')).toHaveLength(7))
    expect(wrapper.findAll('li')[6]!.get('img').attributes('alt')).toBe('Untitled, captured by Lunelame')
    expect(more()).toBeUndefined()
  })

  it('US-12.1 US-12.2 offers Edit and Delete, not while processing; deletes after the confirmation', async () => {
    const wrapper = await mountSuspended(MyCaptures, { props: { username: 'Lunelame' } })
    await vi.waitFor(() => expect(wrapper.findAll('li')).toHaveLength(6))
    const cards = wrapper.findAll('li')
    expect(cards[0]!.get('a[aria-label="Edit « Capture 1 »"]').attributes('href')).toBe(`/my-captures/${id(1)}`)
    expect(cards[3]!.find('.actions').exists()).toBe(false) // processing
    await cards[0]!.get('button[aria-label="Delete « Capture 1 »"]').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('« Capture 1 » will disappear everywhere on the site.'))
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Delete it')!
      .trigger('click')
    await vi.waitFor(() => expect(wrapper.findAll('li')).toHaveLength(5))
    expect(deleted).toEqual([id(1)])
    expect(wrapper.get('[role="status"]').text()).toBe('The capture was deleted.')
  })
})
