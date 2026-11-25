import type { PhotosResponse } from '../../shared/contracts/photos'

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
