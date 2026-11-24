import type { CaptureType } from '../../../../shared/domain/capture-file'

/** Bytes needed by `sniffType`: the WebP signature, RIFF....WEBP. */
export const SNIFF_BYTES = 12

const ascii = (head: Uint8Array, from: number, to: number) => String.fromCharCode(...head.subarray(from, to))

/** The capture type given by the magic bytes (US-10.3), null for any other content (SVG, HTML, TGA…). */
export function sniffType(head: Uint8Array): CaptureType | null {
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg'
  if (ascii(head, 0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png'
  if (ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 12) === 'WEBP') return 'image/webp'
  return null
}
