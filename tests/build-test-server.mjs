// Builds the Nuxt server once for the integration tests (tests/api), into `.nuxt/test/<name>/output`, the folder
// that `setup({ build: false, buildDir })` of @nuxt/test-utils starts. Usage: node tests/build-test-server.mjs <name>
// Run in its own process: nuxt.config.ts reads NUXT_DEPLOY_ENV when it loads (preview build: /__test routes).
import { resolve } from 'node:path'
import { buildNuxt, loadNuxt } from 'nuxt/kit'

const buildDir = resolve('.nuxt/test', process.argv[2])
const nuxt = await loadNuxt({
  cwd: process.cwd(),
  dev: false,
  overrides: { buildDir, nitro: { output: { dir: resolve(buildDir, 'output') } } },
})
await buildNuxt(nuxt)
await nuxt.close()
