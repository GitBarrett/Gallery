import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { like } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { users } from '../../server/db/schema'
import { ErrorResponse } from '../../shared/contracts/errors'

process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)

afterAll(async () => {
  await db.delete(users).where(like(users.username, 'Prof_%'))
  await db.$client.end()
})

async function member(status = 'active') {
  const username = `Prof_${crypto.randomUUID().slice(0, 8)}`
  await db
    .insert(users)
    .values({ username, status, bio: 'Moonwell watcher.', createdAt: new Date('2026-11-01T10:00:00Z') })
  return username
}

describe('GET /api/users/{username}', () => {
  it('US-05.3 gives the public profile in any case, with the display case and no private field', async () => {
    const username = await member()
    const response = await fetch(`/api/users/${username.toLowerCase()}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      username,
      bio: 'Moonwell watcher.',
      memberSince: '2026-11-01T10:00:00.000Z',
    })
  })

  it('US-05.3 answers 404 for an unknown, banned or deleted account', async () => {
    for (const username of ['Prof_nobody', await member('banned'), await member('pending_deletion')]) {
      const response = await fetch(`/api/users/${username}`)
      expect(response.status, username).toBe(404)
      expect(ErrorResponse.parse(await response.json()).error.code).toBe('NOT_FOUND')
    }
  })
})
