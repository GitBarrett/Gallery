import type { ImageInfo, ImageService, VariantFormat } from '../../server/modules/media'
import { pngImage } from '../builders/images'

/**
 * FakeImageService (11-strategie-de-tests.md § 3): `info` gives what the test declares, `render` gives a few bytes
 * naming the variant, and a 64 px PNG of `thumbnail` for the luminance. `renders` counts the transformations
 * (ADR-012: 6 per capture, none on display); `failing` makes the next calls throw, like an outage of the service.
 */
export function fakeImageService(
  info: ImageInfo = { format: 'image/jpeg', width: 1920, height: 1080 },
  thumbnail: (x: number, y: number) => [number, number, number] = () => [0, 0, 0],
) {
  const renders: { width: number; format: VariantFormat; quality?: number }[] = []
  const state = { failing: false, infoCalls: 0 }
  const drain = (image: ReadableStream<Uint8Array>) => new Response(image).arrayBuffer()
  const images: ImageService = {
    async info(image) {
      await drain(image)
      if (state.failing) throw new Error('Images unavailable')
      state.infoCalls++
      return info
    },
    async render(image, { width, format, quality }) {
      await drain(image)
      if (state.failing) throw new Error('Images unavailable')
      renders.push({ width, format, quality })
      if (format === 'image/png') return pngImage(64, 36, thumbnail)
      return new TextEncoder().encode(`${width}:${format}:${quality}`)
    },
  }
  return { images, renders, state }
}
