import { expect, test } from './fixtures'
import { hydrated } from './helpers'

// Bilingual site (T-07b): English at `/`, French under `/fr/`, browser detection on the root only.

test.describe('with a German browser', () => {
  test.use({ locale: 'de-DE' })

  test('US-62.1 a browser in another language than French gets the site in English', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
  })
})

test.describe('with a French browser', () => {
  test.use({ locale: 'fr-FR' })

  test('US-62.2 / redirects to /fr/, the switch changes the language and the choice is remembered', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/fr\/?$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    await expect(page.getByRole('link', { name: 'Se connecter' })).toBeVisible()

    await hydrated(page) // the client navigation writes the cookie
    await page.getByRole('link', { name: 'English' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible()
    const cookie = (await context.cookies()).find((c) => c.name === 'i18n_redirected')
    expect(cookie?.value).toBe('en')

    // Remembered: the French browser now stays in English on /
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})
