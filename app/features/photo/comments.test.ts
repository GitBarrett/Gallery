import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody, setResponseStatus } from 'h3'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import { aMe } from '../../../tests/builders/accounts'
import PhotoComments from './PhotoComments.vue'

const ID = '0193a000-0000-7000-8000-0000000000f1'
const XSS = '<img src=x onerror="window.hacked=1"> **bold** https://example.com'
const at = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const comment = (id: string, username: string, body: string, minutes = 1) => ({
  id: `0193a000-0000-7000-8000-${id.padStart(12, '0')}`,
  body,
  author: { username, avatarUrl: null },
  createdAt: at(minutes),
  editedAt: null,
})

let me: ReturnType<typeof aMe> | null = aMe({ username: 'Ash' })
let items = [comment('1', 'Ash', 'Mine'), comment('2', 'Brook', XSS, 30)]
registerEndpoint('/api/me', (event) => {
  if (me) return me
  setResponseStatus(event, 401)
  return { error: { code: 'UNAUTHENTICATED', message: 'x', correlationId: 'c' } }
})
registerEndpoint(`/api/photos/${ID}/comments`, async (event) => {
  if (event.method === 'GET') return { items, nextCursor: null }
  const { body } = await readBody(event)
  if (body.includes('connard')) {
    setResponseStatus(event, 400)
    const details = { field: 'body', reason: 'insult' }
    return { error: { code: 'VALIDATION_FAILED', message: 'x', details, correlationId: 'c' } }
  }
  setResponseStatus(event, 201)
  return comment('9', 'Ash', body.trim(), 0)
})
registerEndpoint(`/api/comments/${comment('1', '', '').id}`, async (event) => {
  if (event.method === 'DELETE') return null
  const { body } = await readBody(event)
  return { id: comment('1', '', '').id, body, editedAt: new Date().toISOString() }
})
afterEach(() => {
  clearNuxtData()
  me = aMe({ username: 'Ash' })
  items = [comment('1', 'Ash', 'Mine'), comment('2', 'Brook', XSS, 30)]
})

const mount = (author = 'Kaelys') =>
  mountSuspended(PhotoComments, { props: { photoId: ID, total: 2, author }, route: `/p/${ID}` })

describe('PhotoComments', () => {
  it('US-31.1 shows the comments as plain text: no HTML, no Markdown, no link', async () => {
    const section = await mount()
    expect(section.get('h2').text()).toBe('Comments · 2')
    const bodies = section.findAll('.body')
    expect(bodies[1]!.text()).toBe(XSS)
    expect(section.find('.body img').exists()).toBe(false)
    expect(section.findAll('.body a')).toHaveLength(0)
    expect((window as { hacked?: number }).hacked).toBeUndefined()
    expect(await axeViolations(section.element)).toEqual([])
  })

  it('US-31.1 US-31.2 posts a comment at the top, and tells why an insult is blocked', async () => {
    const section = await mount()
    await section.get('textarea').setValue('Lovely light')
    await section.get('form').trigger('submit')
    await vi.waitFor(() => expect(section.findAll('.body')[0]!.text()).toBe('Lovely light'))
    expect(section.get('h2').text()).toBe('Comments · 3')
    expect((section.get('textarea').element as HTMLTextAreaElement).value).toBe('')
    await section.get('textarea').setValue('What a connard')
    await section.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(section.get('[role="alert"]').text()).toBe(
        "This comment contains a word we don't allow. Please rephrase it.",
      ),
    )
  })

  it('US-31.3 US-31.4 lets its author edit a recent comment and delete it; nothing on the comments of others', async () => {
    const section = await mount()
    const [mine, other] = section.findAll('article')
    expect(other!.findAll('button')).toHaveLength(0)
    await mine!
      .findAll('button')
      .find((b) => b.text() === 'Edit')!
      .trigger('click')
    await section.get('article textarea').setValue('Mine, better')
    await section.get('article form').trigger('submit')
    await vi.waitFor(() => expect(section.findAll('.body')[0]!.text()).toBe('Mine, better'))
    expect(section.findAll('article')[0]!.text()).toContain('edited')
    await section
      .findAll('article')[0]!
      .findAll('button')
      .find((b) => b.text() === 'Delete')!
      .trigger('click')
    await vi.waitFor(() => expect(section.findAll('article')).toHaveLength(1))
    expect(section.get('h2').text()).toBe('Comments · 1')
  })

  it('US-31.4 lets the author of the capture delete any comment under it', async () => {
    me = aMe({ username: 'Kaelys' })
    const section = await mount('kaelys')
    const buttons = section
      .findAll('article')[1]!
      .findAll('button')
      .map((b) => b.text())
    expect(buttons).toEqual(['Delete'])
  })

  it('US-31.6 US-08.1 invites to be the first; a visitor to sign in, an unverified member to verify', async () => {
    items = []
    me = null
    const visitor = await mount()
    expect(visitor.text()).toContain('Be the first to comment')
    expect(visitor.find('textarea').exists()).toBe(false)
    expect(visitor.get('a').attributes('href')).toBe(`/signin?redirect=/p/${ID}`)
    clearNuxtData()
    me = aMe({ username: 'Ash', emailVerified: false })
    const unverified = await mount()
    expect(unverified.find('textarea').exists()).toBe(false)
    expect(unverified.text()).toContain('Verify your email to comment.')
  })
})
