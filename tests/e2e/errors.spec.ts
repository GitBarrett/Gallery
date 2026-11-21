import { expect, test } from './fixtures'

// Error pages (T-07c): no mockup, composed with the design system.

test('US-69.1 an unknown URL shows the 404 page with search and a way home, with status 404', async ({ page }) => {
  const response = await page.goto('/this-page-does-not-exist')
  expect(response?.status()).toBe(404)
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Page not found')
  await expect(main.getByRole('searchbox')).toBeVisible()
  await expect(main.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
  // The site layout stays around the error
  await expect(page.getByRole('banner')).toBeVisible()
})

test('US-69.1 the 404 page follows the language of the URL', async ({ page }) => {
  const response = await page.goto('/fr/cette-page-n-existe-pas')
  expect(response?.status()).toBe(404)
  await expect(page.getByRole('main').getByRole('link', { name: "Retour à l'accueil" })).toHaveAttribute('href', '/fr')
})

test('US-69.2 a server error shows the 500 page with a correlation id and no technical detail', async ({ page }) => {
  // The failing route only exists in preview builds (/__test, ADR-013)
  const response = await page.goto('/__test/page-error')
  test.skip(response?.status() === 404, 'test routes are only built for previews')
  expect(response?.status()).toBe(500)
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Something went wrong')
  await expect(main.getByTestId('correlation-id')).toHaveText(/\S{8,}/)
  await expect(page.locator('body')).not.toContainText('T-07c: test error')
  await expect(page.locator('body')).not.toContainText('.ts:')
})
