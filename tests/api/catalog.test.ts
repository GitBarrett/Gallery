import { fetch } from '@nuxt/test-utils/e2e'
import { startTestServer } from './server'
import { like } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createDb } from '../../server/db/client'
import { tags } from '../../server/db/schema'
import { GameVersionsResponse, TagSuggestResponse } from '../../shared/contracts/catalog'
import { LAUNCH_GAME_VERSIONS } from '../fakes/in-memory-catalog-repository'

// Catalogue reads over HTTP and Postgres (T-20a): game versions (migration 0009) and tag suggestions (US-11.1).
process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
await startTestServer()

const db = createDb(process.env.DATABASE_URL!)
const p = `zt${crypto.randomUUID().slice(0, 6)}` // tags of this run only

beforeAll(async () => {
  await db
    .insert(tags)
    .values([`${p} hurlevent`, `${p} hurlevent nuit`, `${p} orgrimmar`].map((slug) => ({ slug, label: slug })))
})

afterAll(async () => {
  await db.delete(tags).where(like(tags.slug, `${p}%`))
  await db.$client.end()
})

describe('catalogue (API)', () => {
  it('US-11.1 serves the game versions to a visitor, in order, cached at the edge', async () => {
    const response = await fetch('/api/game-versions')
    expect(response.headers.get('cache-control')).toBe('public, max-age=60, stale-while-revalidate=300')
    expect(GameVersionsResponse.parse(await response.json())).toEqual({ versions: LAUNCH_GAME_VERSIONS })
  })

  it('US-11.1 suggests the existing tags of what is typed, normalised', async () => {
    const response = await fetch(`/api/tags/suggest?q=${encodeURIComponent(`${p.toUpperCase()} HURL`)}`)
    expect(TagSuggestResponse.parse(await response.json())).toEqual({
      tags: [`${p} hurlevent`, `${p} hurlevent nuit`],
    })
  })

  it('US-11.1 refuses a missing or too long query with 400', async () => {
    expect((await fetch('/api/tags/suggest')).status).toBe(400)
    expect((await fetch(`/api/tags/suggest?q=${'a'.repeat(101)}`)).status).toBe(400)
  })
})
