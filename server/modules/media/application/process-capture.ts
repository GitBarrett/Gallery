import { validateCaptureFile } from '../../../../shared/domain/capture-file'
import { sniffType, SNIFF_BYTES } from '../domain/file-type'
import { decodePng, zoneLuminance } from '../domain/luminance'
import { stripMetadata, strippedSize } from '../domain/metadata'
import {
  incomingKey,
  originalKey,
  variantKey,
  type ImageInfo,
  type ImageService,
  type MediaRepository,
  type ObjectStorage,
  type Processed,
  type Upload,
  type VariantFormat,
} from './ports'

/** Luminance thumbnail (03 § Pipeline image 5): decoded here, never written. */
const THUMBNAIL = { width: 64, format: 'image/png' } as const
/** The variants written once (ADR-012): with the thumbnail, the 6 transformations of a capture. */
export const VARIANTS: { name: string; width: number; format: VariantFormat; quality: number }[] = [
  { name: '1200.jpg', width: 1200, format: 'image/jpeg', quality: 85 }, // moderation and og:image
  ...[400, 800, 1200, 2400].map((width) => ({
    name: `${width}.webp`,
    width,
    format: 'image/webp' as const,
    quality: 82,
  })),
]
// shortcut: every processed capture waits for review until the automatic moderation decides (T-24, Q68)
const PROCESSED = 'pending_review'

type Deps = { repo: MediaRepository; storage: ObjectStorage; images: ImageService }
export type ProcessOutcome = 'processed' | 'rejected' | 'skipped'

const bytesOf = async (stream: ReadableStream<Uint8Array>) => new Uint8Array(await new Response(stream).arrayBuffer())
const streamOf = (parts: AsyncIterable<Uint8Array>) => {
  const iterator = parts[Symbol.asyncIterator]()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await iterator.next()
      if (done) controller.close()
      else controller.enqueue(value)
    },
  })
}

/**
 * Consumer of `photo-process` (US-14.1, 03-architecture.md § Pipeline image 5): magic bytes, `info()` and the file
 * rules, metadata stripped without re-encoding into `originals/{id}` (two passes, the size first), then the luminance
 * and the variants, one at a time. A file that is not a capture is rejected (US-10.3). Idempotent (US-14.2): only a
 * capture still `processing` is handled, a replay rewrites the same keys. A failure of R2 or of the binding throws:
 * the queue retries it (US-10.8).
 */
export const processCapture =
  (deps: Deps) =>
  async (photoId: string): Promise<ProcessOutcome> => {
    const photo = await deps.repo.findUpload(photoId)
    if (!photo?.uploadedAt || photo.status !== 'processing') return 'skipped'
    const info = await cleanOriginal(deps, photo)
    if (!info) return reject(deps, photoId)
    const measures = await writeVariants(deps, photoId)
    await deps.repo.finishProcessing(photoId, PROCESSED, { ...measures, width: info.width, height: info.height })
    return 'processed'
  }

const open = async (storage: ObjectStorage, key: string, length?: number) => {
  const stream = await storage.read(key, length)
  if (!stream) throw new Error(`object missing: ${key}`)
  return stream
}

/** Checks the file, then writes `originals/{id}`: the dimensions read, or null when it is not a capture (US-10.3). */
async function cleanOriginal({ storage, images }: Deps, photo: Upload): Promise<ImageInfo | null> {
  // A replay after the original was written starts from it: stripping it again changes nothing
  const original = originalKey(photo.id)
  const source = (await storage.head(original)) ? original : incomingKey(photo.id)
  const type = sniffType(await bytesOf(await open(storage, source, SNIFF_BYTES)))
  if (!type || type !== photo.mime) return null
  const info = await images.info(await open(storage, source))
  const file = { contentType: info.format, bytes: photo.bytes, width: info.width, height: info.height }
  if (!validateCaptureFile(file).ok || info.format !== type) return null
  if (source === original) return info
  const size = await strippedSize(type, await open(storage, source))
  if (!size.ok) return null
  const stripped = streamOf(stripMetadata(type, await open(storage, source), size.value))
  await storage.put(original, stripped, { bytes: size.value, contentType: type })
  await storage.delete(source)
  return info
}

/** The luminance thumbnail, then the variants, one at a time from the cleaned original (one in memory, ≤ 1 MB). */
async function writeVariants({ storage, images }: Deps, photoId: string): Promise<Omit<Processed, 'width' | 'height'>> {
  const original = originalKey(photoId)
  const luma = zoneLuminance(await decodePng(await images.render(await open(storage, original), THUMBNAIL)))
  for (const variant of VARIANTS) {
    const bytes = await images.render(await open(storage, original), variant)
    await storage.put(variantKey(photoId, variant.name), bytes, { bytes: bytes.length, contentType: variant.format })
  }
  const stored = await storage.head(original)
  if (!stored) throw new Error(`object missing: ${original}`)
  return { bytes: stored.bytes, lumaBl: luma.bl, lumaTr: luma.tr }
}

const reject = async (deps: Deps, photoId: string): Promise<ProcessOutcome> => {
  await failCapture(deps)(photoId)
  return 'rejected'
}

/**
 * A capture still `processing` ends `failed` (rejected file, or retries exhausted: US-10.3, US-10.8) and loses its
 * objects: the author starts again with a new upload. A capture already processed is left alone.
 */
export const failCapture =
  (deps: Pick<Deps, 'repo' | 'storage'>) =>
  async (photoId: string): Promise<void> => {
    if (!(await deps.repo.failProcessing(photoId))) return
    const keys = [incomingKey(photoId), originalKey(photoId), ...VARIANTS.map((v) => variantKey(photoId, v.name))]
    for (const key of keys) await deps.storage.delete(key)
  }
