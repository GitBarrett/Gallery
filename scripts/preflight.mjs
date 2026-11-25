// Local checks before `pnpm dev`, the integration tests, the seed and the migrations: wakes the PostgreSQL of WSL
// Ubuntu (T-04e, systemd starts it), then stops at once with the fix when Node is older than `engines` or the test
// database does not answer, instead of an obscure error minutes later. In CI the WSL step does nothing.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import postgres from 'postgres'

const problems = []

if (process.platform === 'win32') spawnSync('wsl', ['-d', 'Ubuntu', '--exec', 'true'], { stdio: 'ignore' })

const wanted = JSON.parse(readFileSync('package.json', 'utf8')).engines.node.replace('>=', '')
const version = (v) => v.split('.').map(Number)
const [major, minor] = version(process.versions.node)
const [needMajor, needMinor] = version(wanted)
// The CI runs Node 24: a local run on an older one tests something else
if (major < needMajor || (major === needMajor && minor < needMinor))
  problems.push(
    `Node ${process.versions.node} is older than ${wanted} (the CI runs 24). On Windows: ` +
      'winget uninstall --id OpenJS.NodeJS.22 -e, then winget install --id OpenJS.NodeJS.24 -e',
  )

if (existsSync('.env.test')) process.loadEnvFile('.env.test')
const url = process.env.DATABASE_URL
if (!url) problems.push('DATABASE_URL is not set: add it to .env.test (see .env.example).')
else {
  const sql = postgres(url, { connect_timeout: 5, max: 1, onnotice: () => {} })
  try {
    await sql`select 1`
  } catch (error) {
    problems.push(
      `The test database does not answer (${error.code ?? error.message}).` +
        (process.platform === 'win32' ? ' Start it: wsl -u root service postgresql start' : ''),
    )
  } finally {
    await sql.end({ timeout: 1 })
  }
}

if (problems.length) {
  for (const problem of problems) console.error(`preflight: ${problem}`)
  process.exit(1)
}
console.log('preflight: ok')
