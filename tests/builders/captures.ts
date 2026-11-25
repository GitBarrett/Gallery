import type { PhotoResponse, PhotosResponse } from '../../shared/contracts/photos'

/** GET /api/photos/{id}: a published Poor capture of WoW Forever, without details, tags nor avatar. */
export const aPhoto = (more: Partial<PhotoResponse> = {}): PhotoResponse => ({
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
  likes: 0,
  downloads: 0,
  quality: 'poor',
  publishedAt: '2026-11-25T10:00:00.000Z',
  ...more,
})

/** A capture of GET /api/photos: published, Poor, without likes nor zone. `more` overrides. */
export const aCapture = (more: Partial<PhotosResponse['items'][number]> = {}): PhotosResponse['items'][number] => ({
  id: '0193a000-0000-7000-8000-0000000000c1',
  title: 'Dawn on the Plains',
  width: 1920,
  height: 1080,
  author: { username: 'Kaelys' },
  zone: null,
  likes: 0,
  quality: 'poor',
  publishedAt: '2026-11-25T10:00:00.000Z',
  ...more,
})
