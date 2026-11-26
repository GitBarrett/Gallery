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

    it('US-21.2 gives the zone and tag names close to a mistyped text, closest first', async () => {
      const zones = [
        zone('suramar', `Suramar${p}`, `Suramar${p}`),
        zone('pending', `Suramor${p}`, `Suramor${p}`, [], 'pending'),
      ]
      await run({ zones, tags: [`suramarnight${p}`] }, async (repo) => {
        const names = await repo.closestNames(`suramr${p}`, 3)
        expect(names[0]).toBe(`Suramar${p}`) // EN and FR alike: once
        expect(names).not.toContain(`Suramor${p}`) // a pending zone
        expect(await repo.closestNames('qqqqqqzzzzzz', 3)).toEqual([])
      })
    })

    it('US-21.4 finds an active zone by its EN name, FR name or an alias, accents and case ignored', async () => {
      const city = zone('city', `Stormwind City ${p}`, `Hurlevent ${p}`, [`SW ${p}`, `Stormwind ${p}`])
      const zones = [city, zone('pending', `Pending ${p}`, `Attente ${p}`, [], 'pending')]
      await run({ zones }, async (repo) => {
        const id = await repo.zoneId(city.slug)
        for (const name of [`stormwind city ${p}`, `hurlevent ${p}`, `sw ${p}`, `stormwind ${p}`])
          expect(await repo.zoneIdByName(name), name).toBe(id)
        expect(await repo.zoneIdByName(`storm ${p}`)).toBeNull() // a part is not the name
        expect(await repo.zoneIdByName(`pending ${p}`)).toBeNull()
      })
    })

    it('US-11.2 finds an active zone by its slug, not a pending or unknown one', async () => {
      const zones = [zone('active', 'Active', 'Active'), zone('pending', 'Pending', 'En attente', [], 'pending')]
      await run({ zones }, async (repo) => {
        expect(await repo.zoneId(`${p}-active`)).toEqual(expect.any(String))
        expect(await repo.zoneId(`${p}-pending`)).toBeNull()
        expect(await repo.zoneId(`${p}-none`)).toBeNull()
      })
    })

    it('US-11.1 gives the ids of tags, created when new, the same id for an existing one', async () => {
      await run({ tags: [`${p} old`] }, async (repo) => {
        const [old, fresh] = await repo.ensureTags([`${p} old`, `${p} new`])
        expect(old).not.toBe(fresh)
        expect(await repo.ensureTags([`${p} new`, `${p} old`])).toEqual([fresh, old])
        expect(await repo.suggestTags(p, 10)).toEqual([`${p} new`, `${p} old`])
        expect(await repo.ensureTags([])).toEqual([])
      })
    })

    it('US-12.1 reads back a zone and tags by their ids, for the edit form', async () => {
      const zones = [zone('back', 'Back Zone', 'Zone Retour')]
      await run({ zones, tags: [`${p} back`] }, async (repo) => {
        const zoneId = (await repo.zoneId(`${p}-back`))!
        expect(await repo.zoneById(zoneId)).toEqual({ slug: `${p}-back`, nameEn: 'Back Zone', nameFr: 'Zone Retour' })
        const [tagId] = await repo.ensureTags([`${p} back`])
        expect(await repo.tagSlugs([tagId!])).toEqual([`${p} back`])
        expect(await repo.tagSlugs([])).toEqual([])
      })
    })
  })
}
