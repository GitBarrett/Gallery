import { expect, test } from './fixtures'
import { expectImageLoaded, hydrated } from './helpers'
import { publishCapture, testRoute, verifiedMember } from './members'

// Home (T-32b) on the preview. Other specs publish at the same time: the hero and the latest captures are checked by
// their form and by this spec's own capture, never by position or count. Desktop Chromium only (sign-up limits).

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'sign-up limits shared by the CI address')
  await page.goto('/signin')
  const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
  test.skip(reset.status === 404, 'test routes are only built for previews')
})

test.describe.configure({ timeout: 180_000 })

test('US-24.1 US-24.2 US-24.3 the home shows its hero, the version tabs and the latest captures', async ({ page }) => {
  await verifiedMember(page)
  const title = `Home ${crypto.randomUUID().slice(0, 8)}`
  const id = await publishCapture(page, { title, gameVersion: 'wow-forever' }) // dark: a hero candidate

  await page.goto('/')
  await hydrated(page)
  // US-24.1: the fixed hero screenshot (Q99), credited
  const hero = page.getByRole('region', { name: 'Azeroth, seen by its players.' })
  await expect(hero.getByRole('link', { name: 'Upload a capture' })).toHaveAttribute('href', '/upload')
  await expect(hero.getByRole('link', { name: 'Explore the gallery' })).toHaveAttribute('href', '/explore')
  await expectImageLoaded(hero.locator('img'))
  await expect(hero.getByText('Background: a screenshot by Ash Barrett')).toBeVisible()

  // US-24.2: the version tabs lead to their PLP; the latest captures hold the one just published, linked to its page
  await expect(
    page.getByRole('navigation', { name: 'Game versions' }).getByRole('link', { name: 'Retail' }),
  ).toHaveAttribute('href', '/v/retail')
  const latest = page.getByRole('region', { name: 'Latest captures' })
  await expect(latest.getByRole('article').filter({ hasText: title }).getByRole('link')).toHaveAttribute(
    'href',
    `/p/${id}`,
  )
  await expect(latest.getByRole('link', { name: 'Browse all' })).toHaveAttribute('href', '/explore')
  // US-24.3: no open contest (the contests come with T-64, features.contests is off): no quest banner
  await expect(page.getByRole('complementary', { name: 'Contest' })).toHaveCount(0)
  // US-70.4 (the steps of « Capture of the week ») depends on likes and settings: unit and component tests
})
