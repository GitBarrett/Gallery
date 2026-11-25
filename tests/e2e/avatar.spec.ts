import { expect, test } from './fixtures'
import { testRoute, verifiedMember } from './members'

// Avatar (T-28b) on the preview: an image chosen in the settings, its centred square cut in the browser, the PUT
// straight to the private bucket, the processing and the fake moderation (clean: published), then the avatar in the
// header and on the profile. Desktop Chromium only (sign-up limits).

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sign-up limits shared by the CI address')
  await page.goto('/signin')
  const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
  test.skip(reset.status === 404, 'test routes are only built for previews')
})

test.describe.configure({ timeout: 180_000 })

test('US-07.6 US-05.3 an image chosen in the settings becomes the avatar of the header and the profile', async ({
  page,
}) => {
  await verifiedMember(page)
  await page.goto('/settings')
  const profileLink = page.getByRole('link', { name: 'My profile' })
  await expect(profileLink.locator('img')).toHaveCount(0) // the initial until then

  // An 800 × 600 PNG drawn in the page: not square, the browser keeps its centred square
  const png = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(800, 600)
    const context = canvas.getContext('2d')!
    context.fillStyle = '#2f4a2a'
    context.fillRect(0, 0, 800, 600)
    context.fillStyle = '#e8c26a'
    context.fillRect(300, 200, 200, 200)
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    return [...new Uint8Array(await blob.arrayBuffer())]
  })
  await page.locator('.avatar-form input[type="file"]').setInputFiles({
    name: 'me.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png),
  })
  await expect(page.getByRole('img', { name: 'Your new avatar' })).toBeVisible()
  await page.getByRole('button', { name: 'Use this avatar' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'being checked' })).toBeVisible()

  // Processed and published off the request: the next pages show it
  await expect
    .poll(
      async () => {
        await page.reload()
        return profileLink
          .locator('img')
          .getAttribute('src', { timeout: 1_000 })
          .catch(() => null)
      },
      { timeout: 90_000, intervals: [3_000] },
    )
    .toMatch(/^\/avatar\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/64$/)
  const src = (await profileLink.locator('img').getAttribute('src'))!
  const served = await page.request.get(src)
  expect(served.status()).toBe(200)
  expect(served.headers()['content-type']).toBe('image/webp')

  await profileLink.click()
  await expect(page.locator('.identity img')).toHaveAttribute('src', src.replace(/\/64$/, '/256'))
})
