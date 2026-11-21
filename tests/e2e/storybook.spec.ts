import { expect, test } from './fixtures'

// Design system et playbook publiés avec le site (ADR-019), hors des moteurs de recherche. Seulement sur un
// déploiement (preview, production) : `pnpm dev` ne sert pas Storybook.
test('Storybook is served under /storybook/ without being indexed', async ({ page }) => {
  test.skip(!process.env.BASE_URL, 'Storybook is only published with a deployment')
  // Via la page : la fixture n'ajoute le jeton Access qu'aux navigations du navigateur
  const response = await page.goto('/storybook/')
  expect(response?.status()).toBe(200)
  expect(response?.headers()['x-robots-tag']).toBe('noindex')
  await expect(page).toHaveTitle(/storybook/i)
})
