import { expect, test } from './fixtures'

// Smoke test: the home page responds on every device, with no resource blocked by the CSP (08-securite.md § 5).
test('home page responds without CSP violations', async ({ page, baseURL }) => {
  const violations: string[] = []
  page.on('console', (message) => {
    if (/content security policy/i.test(message.text())) violations.push(message.text())
  })
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)
  // Served by the tested site, not by the Cloudflare Access login page
  expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin)
  await expect(page.locator('main')).toBeAttached()
  await page.waitForLoadState('networkidle')
  expect(violations).toEqual([])
})
