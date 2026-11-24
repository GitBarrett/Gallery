import { describe, expect, it } from 'vitest'
import type { CatalogRepository } from '../../server/modules/catalog'
import { LAUNCH_GAME_VERSIONS } from '../fakes/in-memory-catalog-repository'

// Contract of the CatalogRepository port (11-strategie-de-tests.md § 4): checked on the fake and the database.
// `run` gives a repository holding the launch versions and these normalised `tags`, then calls `check` with it.
export function catalogRepositoryContract(
  name: string,
  run: (tags: string[], check: (repo: CatalogRepository) => Promise<void>) => Promise<void>,
) {
  // A prefix of its own, so that the tags of other tests never match
  const p = `zq${crypto.randomUUID().slice(0, 6)}`

  describe(`CatalogRepository contract: ${name}`, () => {
    it('US-11.1 lists the launch game versions in their order', async () => {
      await run([], async (repo) => expect(await repo.listGameVersions()).toEqual(LAUNCH_GAME_VERSIONS))
    })

    it('US-11.1 suggests the tags starting with the prefix, in code point order, up to the limit', async () => {
      const tags = [`${p}b`, `${p}a-b`, `${p}ab`, `${p}a b`, `${p}a`, 'other']
      await run(tags, async (repo) => {
        expect(await repo.suggestTags(p, 10)).toEqual([`${p}a`, `${p}a b`, `${p}a-b`, `${p}ab`, `${p}b`])
        expect(await repo.suggestTags(`${p}a`, 2)).toEqual([`${p}a`, `${p}a b`])
        expect(await repo.suggestTags(`${p}c`, 10)).toEqual([])
      })
    })
  })
}
