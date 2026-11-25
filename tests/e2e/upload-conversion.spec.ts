import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { testRoute, verifiedMember } from './members'

// Conversion in the browser (T-26b, US-10.9): the files are made in the page, a vertical gradient plus a fixed noise
// of amplitude `k`, sized with the same encoders (ADR-020): 5120 × 2160 at k = 6 gives a PNG of about 24 MB and a
// lossless WebP of about 18 MB; 7680 × 4320 at k = 6 a PNG and a WebP over 20 MB and a JPEG 95 of about 13 MB.
// Desktop Chromium only (sign-up limits, memory of the runner).

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sign-up limits shared by the CI address')
  await page.goto('/signin')
  const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
  test.skip(reset.status === 404, 'test routes are only built for previews')
})

test.describe.configure({ timeout: 300_000 })

/** Makes the file in the page and gives it to the form's file field; its size in bytes. */
function choose(page: Page, kind: 'tga' | 'png', width: number, height: number, k: number) {
  return page.evaluate(
    async ([kind, width, height, k]) => {
      const rgba = new Uint8ClampedArray(width * height * 4)
      let s = 1234567
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4
          for (let c = 0; c < 3; c++) {
            s ^= s << 13
            s ^= s >>> 17
            s ^= s << 5
            rgba[i + c] = (y / height) * 200 + c * 20 + ((s >>> 0) % (2 * k + 1)) - k
          }
          rgba[i + 3] = 255
        }
      let blob: Blob
      if (kind === 'png') {
        const canvas = new OffscreenCanvas(width, height)
        canvas.getContext('2d')!.putImageData(new ImageData(rgba, width, height), 0, 0)
        blob = await canvas.convertToBlob({ type: 'image/png' }) // a fixture, not the site's encoder
      } else {
        const tga = new Uint8Array(18 + width * height * 3)
        tga.set([0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, width & 255, width >> 8, height & 255, height >> 8, 24, 0x20])
        for (let p = 0, o = 18; p < width * height; p++, o += 3)
          tga.set([rgba[p * 4 + 2]!, rgba[p * 4 + 1]!, rgba[p * 4]!], o)
        blob = new Blob([tga])
      }
      const transfer = new DataTransfer()
      transfer.items.add(new File([blob], `capture.${kind}`, { type: kind === 'png' ? 'image/png' : '' }))
      const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
      input.files = transfer.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return blob.size
    },
    [kind, width, height, k] as const,
  )
}

async function openForm(page: Page) {
  await verifiedMember(page)
  await page.goto('/upload')
  await expect(page.getByLabel('Game version').locator('option')).not.toHaveCount(1) // mounted
}

test('US-10.1 a TGA is converted to a lossless PNG, then uploaded and published', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) violations.push(message.text())
  })
  await openForm(page)
  await choose(page, 'tga', 1920, 1080, 6)
  await expect(page.getByText('✓ Format TGA, converted to lossless PNG')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('capture.png')).toBeVisible()
  await page.getByLabel('Title').fill('Converted in the browser')
  await page.getByLabel('Game version').selectOption('wow-forever')
  await page.getByLabel(/I took this capture myself/).check()
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Quest accepted.' })).toBeVisible({ timeout: 60_000 })
  const { body } = await testRoute(page, '/api/me/photos', 'GET')
  await expect
    .poll(async () => (await testRoute(page, `/__test/photos/${body.items[0].id}`, 'GET')).body?.status, {
      timeout: 120_000,
    })
    .toBe('published')
  expect(violations).toEqual([]) // the worker and its WebAssembly, under the CSP
})

test('US-10.9 a 5120 × 2160 PNG over 20 MB becomes a lossless WebP, without a warning', async ({ page }) => {
  await openForm(page)
  expect(await choose(page, 'png', 5120, 2160, 6)).toBeGreaterThan(20_000_000)
  await expect(page.getByText('✓ Over 20 MB, converted to lossless WebP')).toBeVisible({ timeout: 120_000 })
  await expect(page.getByText('capture.webp')).toBeVisible()
  await expect(page.getByText(/converted to JPEG quality 95/)).toHaveCount(0)
})

test('US-10.9 an 8K TGA too large even in lossless WebP becomes a JPEG 95, with a warning', async ({ page }) => {
  await openForm(page)
  await choose(page, 'tga', 7680, 4320, 6)
  await expect(page.getByText('✓ Converted to JPEG (quality 95)')).toBeVisible({ timeout: 240_000 })
  await expect(page.getByText(/converted to JPEG quality 95, which loses a little detail/)).toBeVisible()
  await expect(page.getByText('✓ 7680 × 4320, within 640–7680 px')).toBeVisible()
})
