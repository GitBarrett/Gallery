import { expect, test } from './fixtures'
import { testRoute, verifiedMember } from './members'

// Automatic moderation (T-24) on the preview: real R2, real Images binding, fake moderation provider, which scores a
// capture by its title (`…_nsfw` → 0.95). Desktop Chromium only (sign-up limits shared by the CI address).

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sign-up limits shared by the CI address')
  await page.goto('/signin')
  const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
  test.skip(reset.status === 404, 'test routes are only built for previews')
})

// A sign-up, two uploads and their processing through the queues
test.describe.configure({ timeout: 240_000 })

test('US-50.1 US-50.3 US-14.3 the NSFW fixture is rejected into trash/, a clean capture published, both notified', async ({
  page,
}) => {
  await verifiedMember(page)
  const photoIds = await page.evaluate(async () => {
    const canvas = new OffscreenCanvas(1280, 720)
    const context = canvas.getContext('2d')!
    context.fillStyle = '#3a5a78'
    context.fillRect(0, 0, 1280, 720)
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    const json = { 'content-type': 'application/json' }
    const upload = async (title: string) => {
      const declared = { contentType: blob.type, bytes: blob.size, width: 1280, height: 720 }
      const asked = await fetch('/api/photos/upload-url', {
        method: 'POST',
        headers: json,
        body: JSON.stringify(declared),
      })
      const { photoId, url } = await asked.json()
      await fetch(url, { method: 'PUT', headers: { 'content-type': blob.type }, body: blob })
      await fetch(`/api/photos/${photoId}/complete`, {
        method: 'POST',
        headers: json,
        body: JSON.stringify({ title, gameVersion: 'wow-forever' }),
      })
      return photoId as string
    }
    return { rejected: await upload('Fixture_nsfw'), published: await upload('Ice Crown') }
  })

  const settled = async (photoId: string) => {
    await expect
      .poll(async () => (await testRoute(page, `/__test/photos/${photoId}`, 'GET')).body?.status, { timeout: 180_000 })
      .not.toBe('processing')
    return (await testRoute(page, `/__test/photos/${photoId}`, 'GET')).body
  }
  expect(await settled(photoIds.rejected)).toMatchObject({
    status: 'rejected',
    moderationScore: 0.95,
    objects: [],
    trashed: true,
  })
  expect(await settled(photoIds.published)).toMatchObject({
    status: 'published',
    moderationScore: 0.02,
    trashed: false,
  })

  // The author's Quest log, through the notifications queue
  await expect
    .poll(async () => (await testRoute(page, '/api/notifications', 'GET')).body?.notifications.length, {
      timeout: 60_000,
    })
    .toBe(2)
  await page.goto('/notifications')
  await expect(page.getByText('Your capture “Fixture_nsfw” was rejected by the automatic moderation')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Appeal' })).toHaveAttribute('href', '/terms')
  await expect(page.getByText('Your capture “Ice Crown” was published.')).toBeVisible()
})
