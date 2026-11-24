import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { cruise } from 'dependency-cruiser'
import { describe, expect, it } from 'vitest'
import { ROUTES, routeOf } from './authorization-matrix'

// Rules of 10-clean-architecture.md § 7, checked on a demo tree:
// one violation per rule, plus allowed imports that must trigger nothing.
const { forbidden, options } = createRequire(import.meta.url)('../.dependency-cruiser.cjs')
const fixture = fileURLToPath(new URL('./fixtures/architecture', import.meta.url))

describe('architecture rules', () => {
  it('flags every forbidden import and nothing else', async () => {
    const { tsConfig: _projectOnly, ...cruiseOptions } = options
    const result = await cruise(['app', 'server', 'shared'], {
      ...cruiseOptions,
      validate: true,
      baseDir: fixture,
      ruleSet: { forbidden },
    })
    if (typeof result.output === 'string') throw new Error('unexpected text output')
    const violations = result.output.summary.violations.map((v) => `${v.rule.name}: ${v.from} -> ${v.to}`).sort()

    expect(violations).toEqual([
      'api-thin: server/api/photos.ts -> server/db/schema.ts',
      'api-thin: server/api/photos.ts -> server/modules/media/infrastructure/repo.ts',
      'application-no-tech: server/modules/media/application/request.ts -> server/modules/media/infrastructure/repo.ts',
      'domain-pure: server/modules/media/domain/upload.ts -> server/modules/media/infrastructure/repo.ts',
      'module-boundary: server/modules/social/application/like.ts -> server/modules/media/domain/index.ts',
      'pages-no-api: app/pages/index.ts -> app/services/api/client.ts',
      'shared-isolated: shared/domain/leaks-app.ts -> app/services/api/client.ts',
      'ui-pure: app/components/ui/button.ts -> app/features/upload/use-upload.ts',
      'ui-pure: app/components/ui/button.ts -> app/services/api/client.ts',
    ])
  })
})

// Deny by default (08-securite.md § 4, T-18a): a route file must be in the inventory of the matrix, with an access its
// code follows and a row of annexe B
describe('authorization matrix', () => {
  const files = ['server/api', 'server/routes/auth'].flatMap((dir) =>
    readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map((f) => `${dir}/${f.replaceAll('\\', '/')}`),
  )
  const annexB = readFileSync('docs/08-securite.md', 'utf8')

  it('US-55 lists every route and only existing ones', () => {
    expect(files.map(routeOf).sort()).toEqual(Object.keys(ROUTES).sort())
  })

  it('US-55 asks for a session in exactly the member and staff routes, each one tied to a row of annexe B', () => {
    for (const file of files) {
      const { access, row } = ROUTES[routeOf(file)]!
      expect(readFileSync(file, 'utf8').includes('requireContext(event)'), file).toBe(access !== 'public')
      expect(annexB.includes(`| ${row}`), `${file}: row "${row}"`).toBe(true)
    }
  })
})
