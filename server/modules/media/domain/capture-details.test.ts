import { describe, expect, it } from 'vitest'
import { checkDetails, textOrNone } from './capture-details'

describe('checkDetails', () => {
  it('US-11.1 normalises the tags to lower case without accents, each once', () => {
    expect(checkDetails({ title: 'Dusk', tags: ['Aube', 'AUBE', ' Hurlevent ', 'ciel étoilé'] })).toEqual({
      ok: true,
      value: { tags: ['aube', 'hurlevent', 'ciel etoile'] },
    })
  })

  it('US-11.1 refuses a tag of 1 or 31 characters, an odd character, and more than 10 tags', () => {
    expect(checkDetails({ title: 'Dusk', tags: ['a'] })).toEqual({
      ok: false,
      error: { field: 'tags', reason: 'length' },
    })
    expect(checkDetails({ title: 'Dusk', tags: ['a'.repeat(31)] })).toMatchObject({ error: { reason: 'length' } })
    expect(checkDetails({ title: 'Dusk', tags: ['#night'] })).toMatchObject({ error: { reason: 'charset' } })
    const eleven = Array.from({ length: 11 }, (_, i) => `tag ${i}`)
    expect(checkDetails({ title: 'Dusk', tags: eleven })).toMatchObject({
      error: { field: 'tags', reason: 'too_many' },
    })
    expect(checkDetails({ title: 'Dusk', tags: [...eleven.slice(0, 10), 'TAG 0'] }).ok).toBe(true) // a duplicate
  })

  it('US-11.5 refuses an insult in the title and in every other free text', () => {
    expect(checkDetails({ title: 'Connard en vue' })).toEqual({
      ok: false,
      error: { field: 'title', reason: 'insult' },
    })
    for (const field of ['description', 'altText', 'caption', 'zoneCustom', 'graphicsSettings', 'characterName'])
      expect(checkDetails({ title: 'Dusk', [field]: 'quel connard' })).toEqual({
        ok: false,
        error: { field, reason: 'insult' },
      })
    expect(checkDetails({ title: 'Dusk', caption: 'The canals glow brighter tonight.' })).toEqual({
      ok: true,
      value: { tags: [] },
    })
  })
})

describe('textOrNone', () => {
  it('drops a text left empty', () => {
    expect([textOrNone(undefined), textOrNone('  '), textOrNone(' Dusk ')]).toEqual([undefined, undefined, 'Dusk'])
  })
})
