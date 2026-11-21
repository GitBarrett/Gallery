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

// US-75.2 in a real browser (native <dialog>, inert page), on the Modal story of the published Storybook
test('US-75.2 a modal traps focus, closes with Escape and gives focus back', async ({ page }) => {
  test.skip(!process.env.BASE_URL, 'Storybook is only published with a deployment')
  await page.goto('/storybook/iframe.html?id=ui-molecules-modal--default&viewMode=story')
  const opener = page.getByRole('button', { name: 'Report a bug' })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Report a bug' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused()
  for (let i = 0; i < 5; i++) await page.keyboard.press('Tab')
  await expect(dialog.locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(opener).toBeFocused()
})
