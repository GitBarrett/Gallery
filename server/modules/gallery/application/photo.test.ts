import { describe, expect, it } from 'vitest'
import { viewPhoto, type PhotoRow } from './photo'

const thresholds = { uncommon: 3, rare: 15, epic: 50, legendary: 150 }
const row: PhotoRow = {
  id: '0193a000-0000-7000-8000-0000000000c1',
  title: 'Dawn on the Plains',
  description: null,
  altText: null,
  caption: null,
  width: 1920,
  height: 1080,
  mime: 'image/png',
  bytes: 9_400_000,
  version: { slug: 'wow-forever', nameEn: 'WoW Forever', nameFr: 'WoW Forever' },
  zone: null,
  inGameTime: null,
  graphicsSettings: null,
  characterName: null,
  tags: [],
  author: { username: 'Kaelys', avatarUrl: null },
  likes: 60,
  downloads: 0,
  comments: 0,
  publishedAt: new Date('2026-11-25T10:00:00Z'),
}

describe('viewPhoto', () => {
  it('US-25.1 gives a published capture with its quality from its likes and the thresholds of the settings', async () => {
    const view = viewPhoto({
      photos: { photo: async (id) => (id === row.id ? row : null) },
      thresholds: async () => thresholds,
    })
    expect(await view({ id: row.id })).toEqual({ ok: true, value: { ...row, quality: 'epic' } })
    expect(await view({ id: '0193a000-0000-7000-8000-0000000000c9' })).toEqual({
      ok: false,
      error: { kind: 'not_found' },
    })
  })
})
