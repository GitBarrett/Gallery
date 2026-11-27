import { describe, expect, it } from 'vitest'
import { anActor } from '../../../../tests/builders/actor'
import { inMemoryCommentsRepository } from '../../../../tests/fakes/in-memory-comments-repository'
import { inMemoryRateLimiter } from '../../../../tests/fakes/in-memory-rate-limiter'
import { inMemoryUnitOfWork } from '../../../../tests/fakes/in-memory-unit-of-work'
import { COMMENTS_PER_10_MIN, deleteComment, editComment, listComments, postComment } from './comments'

const AUTHOR = '0193a000-0000-7000-8000-00000000aa01'
const ash = anActor({ id: '0193a000-0000-7000-8000-00000000aa02', username: 'Ash', avatar: 'v1' })
const brook = anActor({ id: '0193a000-0000-7000-8000-00000000aa03', username: 'Brook' })
const P = '0193a000-0000-7000-8000-00000000bb01'
const MIN = 60_000

function setup(accounts: Record<string, Date> = {}) {
  let t = new Date('2026-11-27T10:00:00Z').getTime()
  const clock = { now: () => new Date(t) }
  const store = inMemoryCommentsRepository(
    clock,
    { [P]: { authorId: AUTHOR }, hidden: { authorId: AUTHOR, public: false } },
    accounts,
  )
  const { uow, sent } = inMemoryUnitOfWork(store.repo)
  const humans: string[] = []
  const human = async (token: string) => (humans.push(token), token === 'good')
  const deps = { repo: store.repo, uow, limiter: inMemoryRateLimiter(clock), human, clock }
  return {
    ...store,
    sent,
    humans,
    post: postComment(deps),
    edit: editComment(deps),
    remove: deleteComment(deps),
    list: listComments(deps),
    advance: (ms: number) => (t += ms),
    clock,
  }
}

const posted = async (s: ReturnType<typeof setup>, actor = ash, body = 'Lovely light') => {
  const result = await s.post({ actor, photoId: P, body })
  if (!result.ok) throw new Error(JSON.stringify(result.error))
  return result.value
}

describe('postComment', () => {
  it('US-31.1 publishes the trimmed text at once, as written, and tells the author of the capture', async () => {
    const s = setup()
    const comment = await posted(s, ash, '  <b>Lovely</b> [link](https://x.y)  ')
    expect(comment).toEqual({
      id: expect.any(String),
      body: '<b>Lovely</b> [link](https://x.y)',
      author: { username: 'Ash', avatarUrl: `/avatar/${ash.id}/v1` },
      createdAt: s.clock.now(),
      editedAt: null,
    })
    expect(s.counts.get(P)).toBe(1)
    expect(s.sent()).toEqual([
      {
        topic: 'notifications',
        payload: { type: 'comment', userId: AUTHOR, photoId: P, commentId: comment.id, actorId: ash.id },
      },
    ])
  })

  it('US-31.1 tells nobody of a comment under their own capture', async () => {
    const s = setup()
    await posted(s, anActor({ id: AUTHOR }))
    expect(s.sent()).toEqual([])
  })

  it('US-31.2 blocks a comment with an insult, an empty or a too long one', async () => {
    const s = setup()
    for (const [body, reason] of [
      ['What a connard', 'insult'],
      ['   ', 'empty'],
      ['a'.repeat(1001), 'too_long'],
    ] as const)
      expect(await s.post({ actor: ash, photoId: P, body })).toEqual({
        ok: false,
        error: { kind: 'invalid', field: 'body', reason },
      })
    expect(s.counts.get(P)).toBe(0)
  })

  it('US-08.1 refuses an unverified member, then a suspended one; a capture not public is not found', async () => {
    const s = setup()
    expect(await s.post({ actor: anActor({ emailVerified: false }), photoId: P, body: 'Hi' })).toEqual({
      ok: false,
      error: { kind: 'forbidden', reason: 'email_unverified' },
    })
    expect(await s.post({ actor: anActor({ status: 'suspended' }), photoId: P, body: 'Hi' })).toEqual({
      ok: false,
      error: { kind: 'forbidden', reason: 'suspended' },
    })
    expect(await s.post({ actor: ash, photoId: 'hidden', body: 'Hi' })).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    })
  })

  it('US-31.5 refuses the 11th comment of an account within 10 minutes (429), then allows it again', async () => {
    expect(COMMENTS_PER_10_MIN).toEqual({ name: 'comments', limit: 10, windowSeconds: 600 })
    const s = setup()
    for (let n = 0; n < 10; n++) await posted(s)
    expect(await s.post({ actor: ash, photoId: P, body: 'One more' })).toEqual({
      ok: false,
      error: { kind: 'rate_limited', retryAfterSeconds: expect.any(Number) },
    })
    s.advance(10 * MIN)
    expect((await s.post({ actor: ash, photoId: P, body: 'One more' })).ok).toBe(true)
  })

  it('US-31.5 asks a Turnstile token of an account less than 24 hours old, not of an older one', async () => {
    const young = anActor({ id: '0193a000-0000-7000-8000-00000000aa09' })
    const s = setup({ [young.id]: new Date('2026-11-27T00:00:00Z') })
    expect(await s.post({ actor: young, photoId: P, body: 'Hi' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'turnstileToken', reason: 'failed' },
    })
    expect(await s.post({ actor: young, photoId: P, body: 'Hi', turnstileToken: 'bad' })).toMatchObject({ ok: false })
    expect((await s.post({ actor: young, photoId: P, body: 'Hi', turnstileToken: 'good' })).ok).toBe(true)
    s.humans.length = 0
    await posted(s, ash)
    expect(s.humans).toEqual([]) // an older account: no check
  })
})

describe('editComment', () => {
  it('US-31.3 updates its own comment within 15 minutes, marked edited; refused after', async () => {
    const s = setup()
    const { id } = await posted(s)
    s.advance(14 * MIN)
    expect(await s.edit({ actor: ash, commentId: id, body: ' Better light ' })).toEqual({
      ok: true,
      value: { id, body: 'Better light', editedAt: s.clock.now() },
    })
    expect(s.comments.get(id)).toMatchObject({ body: 'Better light', editedAt: s.clock.now() })
    s.advance(MIN)
    expect(await s.edit({ actor: ash, commentId: id, body: 'Too late' })).toEqual({
      ok: false,
      error: { kind: 'forbidden', reason: 'edit_window' },
    })
  })

  it('US-31.3 refuses the comment of another member, an insult, and a missing comment', async () => {
    const s = setup()
    const { id } = await posted(s)
    expect(await s.edit({ actor: brook, commentId: id, body: 'Mine now' })).toEqual({
      ok: false,
      error: { kind: 'forbidden', reason: 'not_author' },
    })
    expect(await s.edit({ actor: ash, commentId: id, body: 'connard' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'body', reason: 'insult' },
    })
    expect(await s.edit({ actor: ash, commentId: 'missing', body: 'Hi' })).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    })
  })
})

describe('deleteComment', () => {
  it('US-31.4 deletes for good its own comment, or one under its capture; not another one', async () => {
    const s = setup()
    const mine = await posted(s)
    const other = await posted(s, brook)
    expect(await s.remove({ actor: brook, commentId: mine.id })).toEqual({
      ok: false,
      error: { kind: 'forbidden', reason: 'not_author' },
    })
    expect(await s.remove({ actor: ash, commentId: mine.id })).toEqual({ ok: true, value: undefined })
    expect(await s.remove({ actor: anActor({ id: AUTHOR, status: 'suspended' }), commentId: other.id })).toEqual({
      ok: true,
      value: undefined,
    })
    expect(s.comments.size).toBe(0)
    expect(s.counts.get(P)).toBe(0)
    expect(await s.remove({ actor: ash, commentId: mine.id })).toEqual({ ok: false, error: { kind: 'not_found' } })
  })
})

describe('listComments', () => {
  it('US-31.1 lists the comments of a public capture, newest first, by pages', async () => {
    const s = setup()
    const ids = []
    for (let n = 0; n < 3; n++) {
      ids.push((await posted(s, ash, `Comment ${n}`)).id)
      s.advance(MIN)
    }
    const first = await s.list({ photoId: P, limit: 2 })
    if (!first.ok) throw new Error('refused')
    expect(first.value.items.map((c) => c.body)).toEqual(['Comment 2', 'Comment 1'])
    const next = await s.list({ photoId: P, limit: 2, cursor: first.value.nextCursor! })
    expect(next).toMatchObject({ ok: true, value: { items: [{ id: ids[0], body: 'Comment 0' }], nextCursor: null } })
    expect(await s.list({ photoId: P, limit: 2, cursor: 'bad' })).toEqual({
      ok: false,
      error: { kind: 'invalid', field: 'cursor', reason: 'unknown' },
    })
    expect(await s.list({ photoId: 'hidden', limit: 2 })).toEqual({ ok: false, error: { kind: 'not_found' } })
  })
})
