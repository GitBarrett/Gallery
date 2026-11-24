import { describe, expect, it } from 'vitest'
import type { CatalogRepository } from '../../server/modules/catalog'
import { LAUNCH_GAME_VERSIONS, type SeedZone } from '../fakes/in-memory-catalog-repository'

export interface CatalogSeed {
  tags?: string[]
  zones?: SeedZone[]
}

// Contract of the CatalogRepository port (11-strategie-de-tests.md § 4): checked on the fake and the database.
// `run` gives a repository holding the launch versions and this seed, then calls `check` with it.
export function catalogRepositoryContract(
  name: string,
  run: (seed: CatalogSeed, check: (repo: CatalogRepository) => Promise<void>) => Promise<void>,
) {
  // A prefix of its own, so that the tags and zones of other tests or of the seed never match
  const p = `zq${crypto.randomUUID().slice(0, 6)}`
  const zone = (slug: string, nameEn: string, nameFr: string, aliases: string[] = [], status = 'active') =>
    ({ slug: `${p}-${slug}`, nameEn, nameFr, aliases, status }) as SeedZone

  describe(`CatalogRepository contract: ${name}`, () => {
    it('US-11.1 lists the launch game versions in their order', async () => {
      await run({}, async (repo) => expect(await repo.listGameVersions()).toEqual(LAUNCH_GAME_VERSIONS))
    })

    it('US-11.1 suggests the tags starting with the prefix, in code point order, up to the limit', async () => {
      const tags = [`${p}b`, `${p}a-b`, `${p}ab`, `${p}a b`, `${p}a`, 'other']
      await run({ tags }, async (repo) => {
        expect(await repo.suggestTags(p, 10)).toEqual([`${p}a`, `${p}a b`, `${p}a-b`, `${p}ab`, `${p}b`])
        expect(await repo.suggestTags(`${p}a`, 2)).toEqual([`${p}a`, `${p}a b`])
        expect(await repo.suggestTags(`${p}c`, 10)).toEqual([])
      })
    })

    it('US-11.2 suggests the active zones whose EN name, FR name or alias holds the text, accents ignored', async () => {
      const city = zone('city', `Stormwind ${p}`, `Forêt ${p}`, [`${p}sw`])
      const zones = [city, zone('pending', `Pending ${p}`, `Attente ${p}`, [], 'pending')]
      await run({ zones }, async (repo) => {
        const found = { slug: city.slug, nameEn: city.nameEn, nameFr: city.nameFr }
        expect(await repo.suggestZones(`stormwind ${p}`, 10)).toContainEqual(found)
        expect(await repo.suggestZones(`foret ${p}`, 10)).toContainEqual(found)
        expect(await repo.suggestZones(`${p}sw`, 10)).toContainEqual(found)
        expect((await repo.suggestZones(`pending ${p}`, 10)).map((z) => z.slug)).not.toContain(`${p}-pending`)
      })
    })

    it('US-11.2 suggests the zones up to the limit', async () => {
      const zones = [1, 2, 3].map((n) => zone(`${n}`, `Limit ${p} ${n}`, `Limite ${p} ${n}`))
      await run({ zones }, async (repo) => expect(await repo.suggestZones(`limit ${p}`, 2)).toHaveLength(2))
    })
  })
}
