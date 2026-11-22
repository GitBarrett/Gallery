import { expect, test } from './fixtures'

// Error pages (T-07c, T-07d): no mockup, composed with the design system.

test('US-69.1 US-79.1 an unknown URL shows the "uncharted zone" 404 page with search, Hearthstone and its reference, with status 404', async ({
  page,
}) => {
  const response = await page.goto('/this-page-does-not-exist')
  expect(response?.status()).toBe(404)
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('You have wandered into an uncharted zone')
  await expect(main.getByRole('searchbox')).toBeVisible()
  await expect(main.getByRole('link', { name: 'Use Hearthstone' })).toHaveAttribute('href', '/')
  await expect(main.getByTestId('correlation-id')).toHaveText(/\S{8,}/)
  // The site layout stays around the error
  await expect(page.getByRole('banner')).toBeVisible()
})

test('US-69.1 US-79.1 the 404 page follows the language of the URL', async ({ page }) => {
  const response = await page.goto('/fr/cette-page-n-existe-pas')
  expect(response?.status()).toBe(404)
  const main = page.getByRole('main')
  await expect(main.getByRole('heading', { level: 1 })).toHaveText('Vous vous êtes aventuré en zone inexplorée')
  await expect(main.getByRole('link', { name: 'Utiliser la pierre de foyer' })).toHaveAttribute('href', '/fr')
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
