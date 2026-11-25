import { expect, test } from './fixtures'
import { expectImageLoaded, hydrated } from './helpers'
import { publishCapture, testRoute, verifiedMember } from './members'

// PLP (T-30b) on the preview: a capture published through the real pipeline (API upload, Images binding, fake
// moderation) shows in the grid of its version. The other specs publish in WoW Forever: this one uses Classic Era, and
// Classic progression stays empty. Desktop Chromium only (sign-up limits, test routes).

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sign-up limits shared by the CI address')
  await page.goto('/signin')
  const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
  test.skip(reset.status === 404, 'test routes are only built for previews')
})

// A sign-up, its email, then the processing through the queue
test.describe.configure({ timeout: 180_000 })

test('US-20.1 US-20.2 a published capture shows in the grid of its version, newest first, then the end', async ({
  page,
}) => {
  await verifiedMember(page)
  const title = `Grid ${crypto.randomUUID().slice(0, 8)}`
  await publishCapture(page, { title, gameVersion: 'classic-era' })

  await page.goto('/v/classic-era')
  await expect(page.getByRole('heading', { level: 1, name: 'Classic Era' })).toBeVisible()
  const tile = page.getByRole('article').filter({ hasText: title })
  await expect(tile).toBeVisible()
  await expect(tile).toContainText('Poor')
  await expect(tile).toContainText('New') // under 10 likes, no counter
  await expectImageLoaded(tile.getByRole('img'))
  // Fewer than 30 captures in this version: a single page, then the end of the grid
  await expect(page.getByText("You've seen everything")).toBeVisible()
  await expect(page.getByRole('link', { name: 'Classic Era' })).toHaveAttribute('aria-current', 'page')

  // US-20.3: each filter is written to the URL; the back button returns to the previous grid
  await hydrated(page)
  const filters = page.getByRole('region', { name: 'Filters' })
  await filters.getByLabel('Sort by').selectOption('popular')
  await expect(page).toHaveURL('/v/classic-era?sort=popular')
  await expect(tile).toBeVisible()
  await filters.getByLabel('Time of day').selectOption('dawn') // the capture has no in-game time
  await expect(page).toHaveURL('/v/classic-era?time=dawn&sort=popular')
  await expect(page.getByRole('heading', { name: 'No capture matches these filters' })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL('/v/classic-era?sort=popular')
  await expect(tile).toBeVisible()
  // A shared link gives the same grid, rendered by the server
  await page.goto('/v/classic-era?time=dawn&sort=popular')
  await expect(page.getByRole('heading', { name: 'No capture matches these filters' })).toBeVisible()
})

test('US-71.1 the « ? » of Minimum quality lists the five tiers with the thresholds of the settings', async ({
  page,
}) => {
  await page.goto('/v/wow-forever')
  await hydrated(page)
  const filters = page.getByRole('region', { name: 'Filters' })
  await filters.getByRole('button', { name: 'What is capture quality?' }).click()
  const help = page.getByRole('region', { name: 'Capture quality' })
  // Launch thresholds of site_settings (07 § Seuils de qualité au lancement)
  await expect(help.getByRole('listitem')).toHaveText([
    'Poornew capture',
    'Uncommon3 likes',
    'Rare15 likes',
    'Epic50 likes',
    'Legendary150 likes',
  ])
  await expect(help.getByRole('link', { name: 'How quality works' })).toHaveAttribute('href', '/help/quality')
})

test('US-70.5 a version without capture invites to be the first, with the upload', async ({ page }) => {
  await page.goto('/v/classic-progression')
  await expect(page.getByRole('heading', { name: 'Be the first to capture Classic progression' })).toBeVisible()
  await expect(page.getByRole('main').getByRole('link', { name: 'Upload a capture' })).toHaveAttribute(
    'href',
    '/upload',
  )
})

test('US-20.4 an unknown version is the 404 page; Explore opens the first version', async ({ page }) => {
  expect((await page.goto('/v/cataclysm'))?.status()).toBe(404)
  await page.goto('/')
  await hydrated(page)
  await page.getByRole('banner').getByRole('link', { name: 'Explore' }).click()
  await expect(page).toHaveURL('/v/wow-forever')
  await expect(page.getByRole('heading', { level: 1, name: 'WoW Forever' })).toBeVisible()
})
