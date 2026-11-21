import { expect, test } from './fixtures'

// Design system and playbook published with the site (ADR-019), out of search engines. Only on a
// deployment (preview, production): `pnpm dev` does not serve Storybook.
test('Storybook is served under /storybook/ without being indexed', async ({ page }) => {
  test.skip(!process.env.BASE_URL, 'Storybook is only published with a deployment')
  // Through the page: the fixture only adds the Access token to the browser's navigations
  const response = await page.goto('/storybook/')
  expect(response?.status()).toBe(200)
  expect(response?.headers()['x-robots-tag']).toBe('noindex')
  await expect(page).toHaveTitle(/storybook/i)
})
