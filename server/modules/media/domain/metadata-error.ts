/** `malformed`: the bytes are not a well-formed file of the declared type; `orientation`: UNSUPPORTED_ORIENTATION. */
export type MetadataProblem = 'malformed' | 'orientation'

export class MetadataError extends Error {
  constructor(readonly problem: MetadataProblem) {
    super(problem)
  }
}

/** EXIF Orientation (tag 0x0112) of IFD0 in a TIFF block, with or without the "Exif\0\0" header; null when absent. */
export function exifOrientation(block: Uint8Array): number | null {
  const tiff = block[0] === 0x45 && block[4] === 0 ? block.subarray(6) : block // "Exif\0\0"
  if (tiff.length < 8) return null
  const data = new DataView(tiff.buffer, tiff.byteOffset, tiff.length)
  const le = tiff[0] === 0x49 // "II", else "MM"
  const ifd = data.getUint32(4, le)
  if (ifd + 2 > tiff.length) return null
  const count = data.getUint16(ifd, le)
  for (let entry = ifd + 2; entry + 12 <= tiff.length && entry < ifd + 2 + count * 12; entry += 12)
    if (data.getUint16(entry, le) === 0x0112) return data.getUint16(entry + 8, le)
  return null
}

/** Rotating is not stripping: a capture whose EXIF asks for a rotation is refused (absent from game captures). */
export function checkOrientation(block: Uint8Array): void {
  const orientation = exifOrientation(block)
  if (orientation !== null && orientation !== 1) throw new MetadataError('orientation')
}
