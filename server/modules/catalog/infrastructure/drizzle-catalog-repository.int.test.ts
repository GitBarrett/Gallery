import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { catalogRepositoryContract } from '../../../../tests/contracts/catalog-repository.contract'
import { withRollback } from '../../../../tests/db'
import { gameVersions, tags, zones } from '../../../db/schema'
import { drizzleCatalogRepository } from './drizzle-catalog-repository'

// Rows written in a rolled back transaction: the database shared by the other test files stays untouched
catalogRepositoryContract('Drizzle', (seed, check) =>
  withRollback(async (tx) => {
    if (seed.tags?.length) await tx.insert(tags).values(seed.tags.map((slug) => ({ slug, label: slug })))
    if (seed.zones?.length) await tx.insert(zones).values(seed.zones)
    await check(drizzleCatalogRepository(tx))
  }),
)

describe('drizzleCatalogRepository', () => {
  it('US-11.1 hides an archived game version', async () => {
    await withRollback(async (tx) => {
      await tx
        .insert(gameVersions)
        .values({ slug: 'legacy', nameEn: 'Legacy', nameFr: 'Ancienne', position: 0, archived: true })
      const slugs = (await drizzleCatalogRepository(tx).listGameVersions()).map((v) => v.slug)
      expect(slugs).not.toContain('legacy')
      expect(slugs).toHaveLength(5)
    })
  })

  it('US-57.2 the zones and aliases of docs/seed/zones.csv are in the initialised database', async () => {
    const [, ...lines] = readFileSync('docs/seed/zones.csv', 'utf8').trim().split(/\r?\n/)
    const expected = lines.map((line) => {
      const [slug, nameEn, nameFr, aliases] = line.split(',')
      return { slug, nameEn, nameFr, aliases: aliases ? aliases.split('|') : [], status: 'active' }
    })
    await withRollback(async (tx) => {
      const rows = await tx
        .select({
          slug: zones.slug,
          nameEn: zones.nameEn,
          nameFr: zones.nameFr,
          aliases: zones.aliases,
          status: zones.status,
        })
        .from(zones)
      expect(rows).toEqual(expect.arrayContaining(expected))
      expect(rows).toHaveLength(expected.length)
    })
  })

  it('US-11.2 tolerates a typo and puts the closest zone first', async () => {
    await withRollback(async (tx) => {
      const repo = drizzleCatalogRepository(tx)
      expect((await repo.suggestZones('hurlvent', 10))[0]?.slug).toBe('stormwind')
      expect((await repo.suggestZones('stormw', 10))[0]?.slug).toBe('stormwind')
    })
  })
})
