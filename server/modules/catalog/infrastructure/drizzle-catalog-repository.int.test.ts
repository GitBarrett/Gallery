import { describe, expect, it } from 'vitest'
import { catalogRepositoryContract } from '../../../../tests/contracts/catalog-repository.contract'
import { withRollback } from '../../../../tests/db'
import { gameVersions, tags } from '../../../db/schema'
import { drizzleCatalogRepository } from './drizzle-catalog-repository'

// Rows written in a rolled back transaction: the database shared by the other test files stays untouched
catalogRepositoryContract('Drizzle', (seed, check) =>
  withRollback(async (tx) => {
    if (seed.length) await tx.insert(tags).values(seed.map((slug) => ({ slug, label: slug })))
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
})
