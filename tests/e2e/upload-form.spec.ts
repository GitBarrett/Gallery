import { expect, test } from './fixtures'
import { testRoute, verifiedMember } from './members'

// Upload form (T-26a) on the preview: a real JPEG chosen in the page, its details, the PUT straight to the private
// bucket (connect-src), then the processing and the fake moderation. Desktop Chromium only (sign-up limits).

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sign-up limits shared by the CI address')
  await page.goto('/signin')
  const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
  test.skip(reset.status === 404, 'test routes are only built for previews')
})

test.describe.configure({ timeout: 180_000 })

test('US-10.1 US-11.1 US-11.2 a JPEG goes from the form to the gallery, with its details, without a CSP violation', async ({
  page,
}) => {
  const violations: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) violations.push(message.text())
  })
  await verifiedMember(page)
  await page.goto('/upload')
  // The game versions load once the form is mounted: a file chosen before would find no handler
  await expect(page.getByLabel('Game version').locator('option')).not.toHaveCount(1)

  // A 1920 × 1080 JPEG drawn in the page
  const jpeg = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(1920, 1080)
    const context = canvas.getContext('2d')!
    const gradient = context.createLinearGradient(0, 0, 0, 1080)
    gradient.addColorStop(0, '#7fb3d5')
    gradient.addColorStop(1, '#2f4a2a')
    context.fillStyle = gradient
    context.fillRect(0, 0, 1920, 1080)
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
    return [...new Uint8Array(await blob.arrayBuffer())]
  })
  await page.locator('input[type="file"]').setInputFiles({
    name: 'dawn.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(jpeg),
  })
  await expect(page.getByText('✓ 1920 × 1080, within 640–7680 px')).toBeVisible()

  await page.getByLabel('Title').fill('Dawn on the Plains')
  await page.getByLabel('Game version').selectOption('wow-forever')
  await page.getByLabel('Zone', { exact: true }).fill('Stormw')
  await expect(page.locator('#upload-zones option[value="Stormwind City"]')).toBeAttached()
  await page.getByLabel('Zone', { exact: true }).fill('Stormwind City')
  await page.getByLabel('Caption').fill('First light on the harbour.')
  const tags = page.getByPlaceholder('Add a tag')
  await tags.fill('Aube')
  await tags.press('Enter')
  await expect(page.getByText('#aube')).toBeVisible()
  await expect(page.getByRole('complementary')).toContainText('Dawn on the Plains') // live preview
  await page.getByLabel(/I took this capture myself/).check()
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Quest accepted.' })).toBeVisible({ timeout: 60_000 })

  // The capture, then its processing and the fake moderation (published)
  const { body } = await testRoute(page, '/api/me/photos', 'GET')
  const photoId = body.items[0].id as string
  expect(body.items[0]).toMatchObject({ title: 'Dawn on the Plains', width: 1920, height: 1080 })
  await expect
    .poll(async () => (await testRoute(page, `/__test/photos/${photoId}`, 'GET')).body?.status, { timeout: 120_000 })
    .toBe('published')
  expect(violations).toEqual([])

  // 360 px: the form fits without a horizontal scroll
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/upload')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Upload a capture')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})
