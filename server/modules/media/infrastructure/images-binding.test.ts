import { describe, expect, it } from 'vitest'
import { imagesBindingService, type ImagesBinding } from './images-binding'

const stream = () => new Blob([new Uint8Array([1, 2, 3])]).stream()

describe('Images binding adapter', () => {
  it('US-14.1 scales down to the width, keeping the ratio, in the asked format and quality', async () => {
    const calls: unknown[] = []
    const binding: ImagesBinding = {
      info: async () => ({ format: 'image/png', width: 5120, height: 2160 }),
      input: () => ({
        transform: (transform) => ({
          async output(output) {
            calls.push({ transform, output })
            return { image: () => new Blob([new Uint8Array([7, 7])]).stream() }
          },
        }),
      }),
    }
    const images = imagesBindingService(binding)
    expect(await images.info(stream())).toEqual({ format: 'image/png', width: 5120, height: 2160 })
    expect(await images.render(stream(), { width: 800, format: 'image/webp', quality: 82 })).toEqual(
      new Uint8Array([7, 7]),
    )
    expect(calls).toEqual([
      { transform: { width: 800, fit: 'scale-down' }, output: { format: 'image/webp', quality: 82 } },
    ])
  })

  it('US-10.3 gives no dimensions for an SVG, which the file rules then refuse', async () => {
    const images = imagesBindingService({ info: async () => ({ format: 'image/svg+xml' }), input: () => null! })
    expect(await images.info(stream())).toEqual({ format: 'image/svg+xml', width: 0, height: 0 })
  })
})
