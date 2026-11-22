import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { migrate } from '../scripts/database.mjs'

const run = promisify(execFile)
// One build per kind of server, shared by every tests/api file (tests/api/server.ts) instead of one build per file
const build = (name: string, env: Record<string, string> = {}) =>
  run(process.execPath, ['tests/build-test-server.mjs', name], { env: { ...process.env, ...env } })

// globalSetup of the integration project: the test database (DATABASE_URL) is migrated once, and the two servers
// (production-like and preview, whose /__test routes are chosen at build time) are built once, in parallel
export default async function setup() {
  await Promise.all([
    process.env.DATABASE_URL ? migrate(process.env.DATABASE_URL) : undefined,
    build('server'),
    build('preview', { NUXT_DEPLOY_ENV: 'preview' }),
  ])
}
