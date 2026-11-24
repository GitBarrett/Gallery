import { expect, test } from './fixtures'
import { testRoute, verifiedMember } from './members'

// Load test of the processing (T-22b, US-14.5) on the real Images binding and R2: an 8K JPEG and a 5120 × 2160 PNG
// of almost 20 MB, made of noise in the page (the heaviest case for the encoders), plus a second 8K JPEG, uploaded
// and completed together. Run out of memory, the consumer would fail its 4 attempts and end the captures `failed`.
// Desktop Chromium on previews only (sign-up limits, test routes).

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sign-up limits shared by the CI address')
  await page.goto('/signin')
  const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
  test.skip(reset.status === 404, 'test routes are only built for previews')
})

// Three files of 20 MB made and uploaded from the page, then processed through the queue
test.describe.configure({ timeout: 360_000 })

test('US-14.5 processes an 8K JPEG and a 5120 × 2160 PNG of 20 MB, three at a time, within the memory', async ({
  page,
}) => {
  await verifiedMember(page)
  const photoIds = await page.evaluate(async () => {
    const LIMIT = 20_000_000
    // Noise on the top `share` of the rows, flat below: the size of the file follows the share
    const draw = (width: number, height: number, share: number) => {
      const canvas = new OffscreenCanvas(width, height)
      const context = canvas.getContext('2d')!
      const rows = Math.round(height * share)
      const pixels = context.createImageData(width, rows)
      const words = new Uint32Array(pixels.data.buffer)
      for (let i = 0; i < words.length; i++) words[i] = (Math.random() * 0x1000000) | 0xff000000
      context.fillStyle = '#203040'
      context.fillRect(0, 0, width, height)
      context.putImageData(pixels, 0, 0)
      return canvas
    }
    const largest = async (make: (step: number) => Promise<Blob>) => {
      for (let step = 0; step < 10; step++) {
        const blob = await make(step)
        if (blob.size <= LIMIT) return blob
      }
      throw new Error('no file under 20 MB')
    }
    const jpegCanvas = draw(7680, 4320, 1)
    const jpeg = await largest((step) => jpegCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 - step * 0.05 }))
    const png = await largest((step) => draw(5120, 2160, 0.6 - step * 0.05).convertToBlob({ type: 'image/png' }))
    const files = [
      { blob: jpeg, width: 7680, height: 4320 },
      { blob: png, width: 5120, height: 2160 },
      { blob: jpeg, width: 7680, height: 4320 },
    ]
    const json = { 'content-type': 'application/json' }
    const uploads = await Promise.all(
      files.map(async ({ blob, width, height }) => {
        const declared = { contentType: blob.type, bytes: blob.size, width, height }
        const asked = await fetch('/api/photos/upload-url', {
          method: 'POST',
          headers: json,
          body: JSON.stringify(declared),
        })
        const { photoId, url } = await asked.json()
        const put = await fetch(url, { method: 'PUT', headers: { 'content-type': blob.type }, body: blob })
        return { photoId: photoId as string, put: put.status, bytes: blob.size }
      }),
    )
    for (const { photoId } of uploads)
      await fetch(`/api/photos/${photoId}/complete`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ title: 'Noise of Azeroth', gameVersion: 'wow-forever' }),
      })
    return uploads
  })
  expect(photoIds.map((u) => u.put)).toEqual([200, 200, 200])
  expect(photoIds[0]!.bytes).toBeGreaterThan(15_000_000) // close to the limit, the heavy case asked
  expect(photoIds[1]!.bytes).toBeGreaterThan(15_000_000)

  for (const { photoId } of photoIds) {
    await expect
      .poll(async () => (await testRoute(page, `/__test/photos/${photoId}`, 'GET')).body?.status, { timeout: 240_000 })
      .not.toBe('processing')
    const { body } = await testRoute(page, `/__test/photos/${photoId}`, 'GET')
    expect(body.status).toBe('pending_review') // not `failed`: no attempt ran out of memory
    expect(body.objects).toHaveLength(6) // the cleaned original and the 5 variants (US-14.1)
    expect(body.lumaBl).toBeGreaterThan(0)
  }
  // The real binding reads the real dimensions
  expect((await testRoute(page, `/__test/photos/${photoIds[1]!.photoId}`, 'GET')).body).toMatchObject({
    width: 5120,
    height: 2160,
  })
})
