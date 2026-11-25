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

// A sign-up, three uploads and their processing through the queues
test.describe.configure({ timeout: 240_000 })

test('US-50.1 US-50.3 US-14.3 US-14.4 US-68.3 the NSFW fixture is rejected into trash/, a clean capture published, both notified', async ({
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
    return {
      rejected: await upload('Fixture_nsfw'),
      published: await upload('Ice Crown'),
      review: await upload('Fixture_review'),
    }
  })

  const settled = async (photoId: string) => {
    await expect
      .poll(async () => (await testRoute(page, `/__test/photos/${photoId}`, 'GET')).body?.status, { timeout: 180_000 })
      .not.toBe('processing')
    return (await testRoute(page, `/__test/photos/${photoId}`, 'GET')).body
  }
  expect(await settled(photoIds.rejected)).toMatchObject({ status: 'rejected', moderationScore: 0.95 })
  // The move to trash/ follows the status commit: wait for it
  await expect
    .poll(async () => (await testRoute(page, `/__test/photos/${photoIds.rejected}`, 'GET')).body, { timeout: 30_000 })
    .toMatchObject({ objects: [], trashed: true })
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
    .toBe(3)
  await page.goto('/notifications')
  await expect(page.getByText('Your capture “Fixture_nsfw” was rejected by the automatic moderation')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Appeal' })).toHaveAttribute('href', '/terms')
  await expect(page.getByText('Your capture “Ice Crown” was published.')).toBeVisible()

  // US-68.3 US-14.4 (T-25a): the stored variants served as is, published to anyone, the others only previewed
  const image = (path: string) =>
    page.evaluate(async (url) => {
      const r = await fetch(url)
      return { status: r.status, type: r.headers.get('content-type'), cache: r.headers.get('cache-control') }
    }, path)
  const publicImage = { status: 200, type: 'image/webp', cache: 'public, max-age=2592000, immutable' }
  expect(await image(`/img/${photoIds.published}/800`)).toEqual(publicImage)
  expect(await image(`/img/${photoIds.published}/og.jpg`)).toMatchObject({ status: 200, type: 'image/jpeg' })
  expect((await image(`/img/${photoIds.published}/640`)).status).toBe(404)
  expect(await settled(photoIds.review)).toMatchObject({ status: 'pending_review' })
  expect((await image(`/img/${photoIds.review}/800`)).status).toBe(404)
  expect(await image(`/img/${photoIds.review}/800?preview=1`)).toEqual({ ...publicImage, cache: 'private, no-store' })
  expect((await image(`/img/${photoIds.rejected}/800?preview=1`)).status).toBe(404) // variants removed
  // A visitor (no session cookie): the published image, never the preview
  const anonymous = (path: string) =>
    page.evaluate(async (url) => (await fetch(url, { credentials: 'omit' })).status, path)
  expect(await anonymous(`/img/${photoIds.review}/800?preview=1`)).toBe(404)
  expect(await anonymous(`/img/${photoIds.published}/400`)).toBe(200)
})
