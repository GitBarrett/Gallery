import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook-vue/nuxt'

// Fonts from the Nuxt build (frozen) rather than the @nuxt/fonts cache, which Storybook's Nuxt rewrites during the copy
const FONTS = fileURLToPath(new URL('../.output/public/_nuxt/fonts', import.meta.url))

// Design system and playbook (ADR-019): component stories and MDX playbook pages
const config: StorybookConfig = {
  stories: ['../app/**/*.mdx', '../app/**/*.stories.ts'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: { name: '@storybook-vue/nuxt', options: {} },
  core: { disableTelemetry: true },
  // Self-hosted fonts, referenced as _nuxt/fonts/: run `pnpm build` first; without it, fallback fonts
  // The site's public/ (logo emblem…) and fonts
  staticDirs: ['../public', ...(existsSync(FONTS) ? [{ from: FONTS, to: '/_nuxt/fonts' }] : [])],
}
export default config
