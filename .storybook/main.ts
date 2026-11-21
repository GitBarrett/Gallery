import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook-vue/nuxt'

const FONTS = fileURLToPath(new URL('../node_modules/.cache/nuxt/.nuxt/cache/fonts', import.meta.url))

// Design system et playbook (ADR-019) : stories des composants et pages MDX du playbook
const config: StorybookConfig = {
  stories: ['../app/**/*.mdx', '../app/**/*.stories.ts'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: { name: '@storybook-vue/nuxt', options: {} },
  core: { disableTelemetry: true },
  // Polices auto-hébergées : téléchargées par @nuxt/fonts au build Nuxt (à lancer avant), référencées en _nuxt/fonts/ ;
  // sans elles, Storybook se construit avec les polices de secours
  staticDirs: existsSync(FONTS) ? [{ from: FONTS, to: '/_nuxt/fonts' }] : [],
}
export default config
