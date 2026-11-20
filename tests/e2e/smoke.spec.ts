import { expect, test } from '@playwright/test'

// Test de fumée : la page d'accueil répond sur chaque appareil, sans ressource bloquée par la CSP (08-securite.md § 5).
test('home page responds without CSP violations', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (message) => {
    if (/content security policy/i.test(message.text())) violations.push(message.text())
  })
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  await expect(page.locator('main')).toBeAttached()
  await page.waitForLoadState('networkidle')
  expect(violations).toEqual([])
})
