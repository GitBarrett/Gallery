import { defineNitroConfig } from 'nitropack/config'

export default defineNitroConfig({
  preset: 'cloudflare_module',
  srcDir: 'server', // même arborescence que Nuxt
  compatibilityDate: '2026-11-01',
})
