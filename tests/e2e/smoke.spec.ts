import { expect, test } from '@playwright/test'

// Test de fumée : la page d'accueil répond sur chaque appareil.
test('home page responds', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  await expect(page.locator('main')).toBeAttached()
})
