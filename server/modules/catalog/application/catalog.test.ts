import { describe, expect, it } from 'vitest'
import { inMemoryCatalogRepository } from '../../../../tests/fakes/in-memory-catalog-repository'
import { listGameVersions, suggestTags } from './catalog'

const tags = ['hurlevent', 'hurlevent nuit', 'orgrimmar', ...Array.from({ length: 12 }, (_, i) => `raid ${i + 10}`)]

describe('catalog', () => {
  it('US-11.1 suggests the existing tags starting with what is typed, normalised, 10 at most', async () => {
    const suggest = suggestTags({ repo: inMemoryCatalogRepository({ tags }) })
    expect(await suggest({ q: '  HURL' })).toEqual(['hurlevent', 'hurlevent nuit'])
    expect(await suggest({ q: 'Hurlevent N' })).toEqual(['hurlevent nuit'])
    expect(await suggest({ q: 'raid' })).toHaveLength(10)
    expect(await suggest({ q: '' })).toEqual([])
    expect(await suggest({ q: '%' })).toEqual([])
  })

  it('US-11.1 lists the game versions in their order', async () => {
    const list = listGameVersions({ repo: inMemoryCatalogRepository() })
    expect((await list()).map((v) => v.slug)).toEqual([
      'wow-forever',
      'retail',
      'classic-era',
      'classic-progression',
      'other',
    ])
  })
})
