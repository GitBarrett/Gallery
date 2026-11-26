import { expect, test } from './fixtures'
import { hydrated } from './helpers'
import { publishCapture, testRoute, verifiedMember } from './members'

// Search screen (T-33b) on the preview: a capture published through the real pipeline, found by its title, by a
// mistyped tag, and the page of a search without result. Desktop Chromium only (sign-up limits, test routes).

test.describe('with a published capture', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'sign-up limits shared by the CI address')
    await page.goto('/signin')
    const reset = await testRoute(page, '/__test/rate-limits', 'DELETE')
    test.skip(reset.status === 404, 'test routes are only built for previews')
  })
  // A sign-up, its email, then the processing through the queue
  test.describe.configure({ timeout: 180_000 })

  test('US-21.1 US-21.2 US-21.6 finds a capture by its title and a mistyped tag, and offers more when nothing is found', async ({
    page,
  }) => {
    await verifiedMember(page)
    const run = crypto.randomUUID().slice(0, 8)
    const title = `Dune ${run}`
    await publishCapture(page, { title, gameVersion: 'classic-era', tags: [`sunwell${run}`] })

    // From the field of the header, the results of the title, sorted then back
    await page.goto('/')
    await hydrated(page)
    await page.getByRole('searchbox', { name: 'Search' }).fill(title)
    await page.getByRole('searchbox', { name: 'Search' }).press('Enter')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Results for “dune ${run}”`)
    const tile = page.getByRole('article').filter({ hasText: title })
    await expect(tile).toBeVisible()
    await hydrated(page)
    await page.getByRole('region', { name: 'Filters' }).getByLabel('Sort by').selectOption('recent')
    await expect(page).toHaveURL(new RegExp(`/search\\?q=Dune(\\+|%20)${run}&sort=recent$`))
    await expect(tile).toBeVisible()

    // A typo: the closest tag is searched instead, and said
    await page.goto(`/search?q=sunwel${run}`)
    await expect(page.getByText(`Showing results for sunwell${run}`)).toBeVisible()
    await expect(tile).toBeVisible()

    // Nothing found: the popular tags and the latest captures, never an empty page
    await page.goto(`/search?q=qqqzzz${run}`)
    await expect(page.getByRole('heading', { name: `No capture found for “qqqzzz${run}”` })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Popular tags' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Latest captures' }).getByRole('article').first()).toBeVisible()
  })
})

// shortcut: the 300 ms p95 of US-21.3 is not measured here (a preview is no load test); read it in the analytics
test('US-21.3 suggests the zones while typing, and searches the one chosen', async ({ page }) => {
  await page.goto('/search')
  await expect(page.getByRole('heading', { level: 1, name: 'Search' })).toBeVisible()
  await hydrated(page)
  const box = page.getByRole('combobox', { name: 'Search' })
  await box.fill('Hur')
  const option = page.getByRole('option', { name: /Stormwind City/ })
  await expect(option).toBeVisible()
  await box.press('ArrowDown')
  await expect(page.getByRole('option', { selected: true })).toHaveCount(1)
  await option.click()
  await expect(page).toHaveURL(/\/search\?q=Stormwind(\+|%20)City$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Results for “stormwind city”')
})
