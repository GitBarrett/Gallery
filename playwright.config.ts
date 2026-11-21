import { defineConfig, devices } from '@playwright/test'

// Projets de 11-strategie-de-tests.md : desktop, iPhone 14, Pixel 7. BASE_URL vise une preview en CI (T-04b).
export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // En CI, rapport HTML joint à l'exécution en cas d'échec (preview-deploy)
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'iphone-14', use: { ...devices['iPhone 14'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        env: { NUXT_PUBLIC_SITE_URL: 'http://localhost:3000' },
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
