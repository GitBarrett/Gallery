import { expect, test } from './fixtures'

// Robots on a preview (T-35a, ADR-013): every robot refused and nothing indexed, the sitemap still served. The
// production rules are checked by tests/api/seo.test.ts.

test.beforeEach(({ page: _ }, testInfo) => {
  test.skip(!process.env.BASE_URL, 'previews only')
  test.skip(testInfo.project.name !== 'desktop', 'no layout here')
})

test('US-25.4 a preview refuses every robot and asks not to index it', async ({ page }) => {
  const robots = await page.goto('/robots.txt')
  expect(await robots!.text()).toBe('User-agent: *\nDisallow: /\n')
  expect(robots!.headers()['x-robots-tag']).toBe('noindex, nofollow')
  const home = await page.goto('/')
  expect(home!.headers()['x-robots-tag']).toBe('noindex, nofollow')
})

test('US-25.2 serves the sitemap index and its first batch', async ({ page }) => {
  const index = await page.goto('/sitemap.xml')
  expect(index!.status()).toBe(200)
  expect(await index!.text()).toContain('/sitemap-1.xml</loc>')
  const batch = await page.goto('/sitemap-1.xml')
  expect(await batch!.text()).toContain('/v/wow-forever</loc>')
})
