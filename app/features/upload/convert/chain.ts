import { MAX_CAPTURE_BYTES } from '~~/shared/domain/capture-file'

// Conversion in the browser (03 § Pipeline image 1, ADR-011, US-10.9): a TGA becomes a lossless PNG; a file still
// over 20 MB becomes a lossless WebP, then a JPEG 95 in 4:4:4 with a warning; never a lossy WebP.
export type Encoding = 'png' | 'webp' | 'jpeg'
export type Source = 'tga' | 'png'

const CHAINS: Record<Source, Encoding[]> = { tga: ['png', 'webp', 'jpeg'], png: ['webp', 'jpeg'] }
export const MIME: Record<Encoding, string> = { png: 'image/png', webp: 'image/webp', jpeg: 'image/jpeg' }

/** A TGA (by its extension: browsers give it no type), or a PNG over 20 MB; null when the file goes as it is. */
export function sourceOf(file: { name: string; type: string; size: number }): Source | null {
  if (/\.tga$/i.test(file.name) || file.type === 'image/x-tga' || file.type === 'image/tga') return 'tga'
  if (file.type === 'image/png' && file.size > MAX_CAPTURE_BYTES) return 'png'
  return null
}

/** The encodings to try in order, the first result within 20 MB is kept. */
export const chainOf = (source: Source) => CHAINS[source]

/** Only the JPEG loses information (US-10.9: the member is warned). */
export const isLossy = (encoding: Encoding) => encoding === 'jpeg'

/** The converted file's name: the extension of its new format. */
export const convertedName = (name: string, encoding: Encoding) =>
  `${name.replace(/\.[^.]+$/, '')}.${encoding === 'jpeg' ? 'jpg' : encoding}`
