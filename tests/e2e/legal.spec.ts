import { expect, test } from './fixtures'
import { hydrated } from './helpers'

// Legal pages (T-10b, docs/legal): reached from the footer, in the reader's language, with their update date.
const PAGES = [
  { link: 'Legal notice', path: '/legal', title: 'Legal notice' },
  { link: 'Terms', path: '/terms', title: 'Terms of use' },
  { link: 'Privacy', path: '/privacy', title: 'Privacy policy' },
]

test('US-74.1 each footer link opens its legal page with its update date', async ({ page }) => {
  await page.goto('/')
  for (const { link, path, title } of PAGES) {
    await hydrated(page)
    await page.getByRole('contentinfo').getByRole('link', { name: link }).click()
    await expect(page).toHaveURL(path)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title)
    await expect(page).toHaveTitle(title)
    await expect(page.getByRole('main')).toContainText('Last updated')
  }
})

test('US-74.1 "Cookie settings" opens the cookie panel, which links to the cookie policy', async ({ page }) => {
  await page.goto('/')
  await hydrated(page)
  await page.getByRole('contentinfo').getByRole('button', { name: 'Cookie settings' }).click()
  await page.getByRole('dialog', { name: 'Your cookie choices' }).getByRole('link', { name: 'cookie policy' }).click()
  await expect(page).toHaveURL('/cookies')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cookies and similar technologies')
})

test('US-74.1 in French, the pages are in French', async ({ page }) => {
  await page.goto('/fr/terms')
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("Conditions d'utilisation")
  await expect(page.getByRole('main')).toContainText('Dernière mise à jour')
})
