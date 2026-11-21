import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { StorybookConfig } from '@storybook-vue/nuxt'

// Polices du build Nuxt (figées) plutôt que le cache de @nuxt/fonts, que le Nuxt de Storybook réécrit pendant la copie
const FONTS = fileURLToPath(new URL('../.output/public/_nuxt/fonts', import.meta.url))

// Design system et playbook (ADR-019) : stories des composants et pages MDX du playbook
const config: StorybookConfig = {
  stories: ['../app/**/*.mdx', '../app/**/*.stories.ts'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: { name: '@storybook-vue/nuxt', options: {} },
  core: { disableTelemetry: true },
  // Polices auto-hébergées, référencées en _nuxt/fonts/ : lancer `pnpm build` avant ; sans lui, polices de secours
  // public/ du site (emblème du logo…) et polices
  staticDirs: ['../public', ...(existsSync(FONTS) ? [{ from: FONTS, to: '/_nuxt/fonts' }] : [])],
}
export default config
