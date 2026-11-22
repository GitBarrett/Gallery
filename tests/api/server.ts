import { resolve } from 'node:path'
import { setup } from '@nuxt/test-utils/e2e'

/**
 * Starts the server built once by the globalSetup (tests/db-setup.ts) with this file's environment (NUXT_*
 * variables, read at startup). `preview`: the preview build, with its /__test routes.
 */
export const startTestServer = (kind: 'server' | 'preview' = 'server') =>
  setup({ server: true, browser: false, build: false, buildDir: resolve('.nuxt/test', kind) })
