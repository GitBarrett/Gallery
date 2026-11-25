/// <reference lib="webworker" />
// Conversion of a capture off the main thread (03 § Pipeline image 1, ADR-020): decode, then each encoding of the
// chain until a result fits 20 MB. The WebAssembly encoders (libwebp, MozJPEG, PNG) load only when needed, out of
// the precache. A failure answers `memory` (US-10.10) or `failed`; the page never freezes nor crashes.
import { MAX_CAPTURE_BYTES } from '~~/shared/domain/capture-file'
import { chainOf, type Encoding, type Source } from './chain'
import { decodeTga } from './tga'

export type ConvertRequest = { source: Source; file: ArrayBuffer }
export type ConvertAnswer =
  | { ok: true; bytes: ArrayBuffer; encoding: Encoding; width: number; height: number }
  | { ok: false; error: 'memory' | 'too_large' | 'failed' }

async function decode({ source, file }: ConvertRequest): Promise<ImageData> {
  if (source === 'png') return (await import('@jsquash/png')).decode(file)
  const { width, height, data } = decodeTga(new Uint8Array(file))
  return new ImageData(data, width, height)
}

async function encode(encoding: Encoding, image: ImageData): Promise<ArrayBuffer> {
  if (encoding === 'png') return (await import('@jsquash/png')).encode(image)
  if (encoding === 'webp') return (await import('@jsquash/webp')).encode(image, { lossless: 1, exact: 1 })
  // Quality 95, chroma not subsampled (4:4:4): the red outlines and texts of a capture stay sharp
  return (await import('@jsquash/jpeg')).encode(image, { quality: 95, auto_subsample: false, chroma_subsample: 1 })
}

const memory = (error: unknown) =>
  error instanceof RangeError || /memory|allocation|out of bounds/i.test(String((error as Error)?.message ?? error))

self.onmessage = async ({ data }: MessageEvent<ConvertRequest>) => {
  const post = (answer: ConvertAnswer, transfer: Transferable[] = []) => self.postMessage(answer, transfer)
  try {
    const image = await decode(data)
    for (const encoding of chainOf(data.source)) {
      const bytes = await encode(encoding, image)
      if (bytes.byteLength <= MAX_CAPTURE_BYTES)
        return post({ ok: true, bytes, encoding, width: image.width, height: image.height }, [bytes])
    }
    post({ ok: false, error: 'too_large' })
  } catch (error) {
    post({ ok: false, error: memory(error) ? 'memory' : 'failed' })
  }
}
