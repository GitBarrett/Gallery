import type { ImageService, VariantFormat } from '../application/ports'

/** The Images binding (wrangler.toml `[images]`), reduced to what the adapter uses. */
export interface ImagesBinding {
  info(stream: ReadableStream<Uint8Array>): Promise<{ format: string; width?: number; height?: number }>
  input(stream: ReadableStream<Uint8Array>): {
    transform(transform: { width: number; fit: 'scale-down' }): {
      output(output: { format: VariantFormat; quality?: number }): Promise<{ image(): ReadableStream<Uint8Array> }>
    }
  }
}

/** Decoding and encoding happen in the Images service, out of the Worker's memory (ADR-011). */
export const imagesBindingService = (binding: ImagesBinding): ImageService => ({
  async info(image) {
    const { format, width, height } = await binding.info(image)
    // An SVG has no dimensions: the file rules then refuse it
    return { format, width: width ?? 0, height: height ?? 0 }
  },
  async render(image, { width, format, quality }) {
    const result = await binding.input(image).transform({ width, fit: 'scale-down' }).output({ format, quality })
    return new Uint8Array(await new Response(result.image()).arrayBuffer())
  },
})
