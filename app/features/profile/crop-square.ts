/**
 * Square avatar cut from the chosen image (US-07.6): the centred square, scaled down to 512 px at most and re-encoded
 * as JPEG by the browser (no metadata left). Null when the browser cannot read the file as an image.
 */
export async function cropSquare(file: File): Promise<{ file: File; side: number } | null> {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) return null
  const short = Math.min(bitmap.width, bitmap.height)
  const side = Math.min(short, 512)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = side
  const [x, y] = [(bitmap.width - short) / 2, (bitmap.height - short) / 2]
  canvas.getContext('2d')?.drawImage(bitmap, x, y, short, short, 0, 0, side, side)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  return blob && { file: new File([blob], 'avatar.jpg', { type: 'image/jpeg' }), side }
}
