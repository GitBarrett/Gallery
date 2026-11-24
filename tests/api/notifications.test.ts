import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { eq, like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { phc } from '../../scripts/seed.mjs'
import { createDb } from '../../server/db/client'
import { notifications, users } from '../../server/db/schema'
import { NotificationsResponse, UnreadCountResponse } from '../../shared/contracts/notifications'

// Quest log over HTTP and Postgres (T-23b): a member reads and marks only their own notifications.
process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
process.env.NUXT_FAKE_PROVIDERS = 'true'
process.env.NUXT_APP_SECRET = 'test-only-app-secret-of-32-characters-or-more'
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)
const run = crypto.randomUUID().slice(0, 8)
const password = 'a long passphrase'
const members = { ash: { id: '', cookie: '' }, jaina: { id: '', cookie: '' } }

const call = (path: string, as: keyof typeof members, method = 'GET') =>
  fetch(path, {
    method,
    headers: { 'sec-fetch-site': 'same-origin', 'cf-connecting-ip': crypto.randomUUID(), cookie: members[as].cookie },
  })
const unread = async (as: keyof typeof members) =>
  UnreadCountResponse.parse(await (await call('/api/notifications/unread-count', as)).json()).unread

beforeAll(async () => {
  for (const name of Object.keys(members) as (keyof typeof members)[]) {
    const email = `notifications.${name}.${run}@example.com`
    const [row] = await db
      .insert(users)
      .values({ email, username: `n_${name}_${run}`, passwordHash: phc(password), emailVerifiedAt: new Date() })
      .returning()
    const signedIn = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', 'cf-connecting-ip': run },
      body: JSON.stringify({ email, password }),
    })
    members[name] = { id: row!.id, cookie: (signedIn.headers.get('set-cookie') ?? '').split(';')[0]! }
  }
  await db.insert(notifications).values([
    { userId: members.ash.id, type: 'follow', payload: { actorId: members.jaina.id } },
    { userId: members.ash.id, type: 'moderation', payload: { outcome: 'rejected' } },
    { userId: members.jaina.id, type: 'follow', payload: { actorId: members.ash.id } },
  ])
}, 60_000)

afterAll(async () => {
  await db.delete(users).where(like(users.email, `notifications.%.${run}@example.com`)) // notifications cascade
  await db.$client.end()
})

describe('/api/notifications', () => {
  it('US-35.3 lists the member’s own notifications with the usernames of now, and counts the unread', async () => {
    const response = await call('/api/notifications', 'ash')
    expect(response.status).toBe(200)
    const { notifications: listed } = NotificationsResponse.parse(await response.json())
    expect(listed.map((n) => [n.type, n.actor, n.detail, n.read])).toEqual(
      expect.arrayContaining([
        ['follow', `n_jaina_${run}`, null, false],
        ['moderation', null, 'rejected', false],
      ]),
    )
    expect(listed).toHaveLength(2)
    expect(await unread('ash')).toBe(2)
  })

  it('US-35.3 marks one as read, 404 for another member’s, then all as read', async () => {
    const [theirs] = await db.select().from(notifications).where(eq(notifications.userId, members.jaina.id))
    expect((await call(`/api/notifications/${theirs!.id}/read`, 'ash', 'POST')).status).toBe(404)
    expect(await unread('jaina')).toBe(1)

    const [mine] = await db.select().from(notifications).where(eq(notifications.userId, members.ash.id))
    expect((await call(`/api/notifications/${mine!.id}/read`, 'ash', 'POST')).status).toBe(204)
    expect(await unread('ash')).toBe(1)
    expect((await call('/api/notifications/read-all', 'ash', 'POST')).status).toBe(204)
    expect(await unread('ash')).toBe(0)
    expect(await unread('jaina')).toBe(1)
  })
})
