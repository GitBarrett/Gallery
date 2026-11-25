import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

// Local test database (Neon dev-… branch): DATABASE_URL in .env.test, ignored by git; in CI, a Postgres service
if (existsSync('.env.test')) process.loadEnvFile('.env.test')

// Three projects (11-strategie-de-tests.md § 1).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'scripts/**/*.test.ts', 'tests/*.test.ts'],
          exclude: ['**/*.int.test.ts'],
        },
      },
      await defineVitestProject({
        test: {
          name: 'component',
          environment: 'nuxt',
          include: ['app/**/*.test.ts'],
        },
      }),
      {
        test: {
          name: 'integration',
          environment: 'node',
          globalSetup: ['tests/db-setup.ts'],
          testTimeout: 30_000, // real database (Neon locally): database creation and migrations
          include: ['server/**/*.int.test.ts', 'tests/api/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      // Pages, layouts and app.vue are thin and covered by E2E tests (10-clean-architecture.md § 6)
      include: [
        'scripts/**',
        'shared/**',
        'server/**',
        'app/components/**',
        'app/features/**',
        'app/composables/**',
        'app/services/**',
      ],
      // Nitro glue (routes, middlewares, plugins, error handler): run in the integration test server.
      // scripts/cloud.mjs, preview.mjs and lighthouse.mjs: API, wrangler and browser calls, checked
      // on real previews (T-03b, T-04b); their pure rules are tested separately.
      exclude: [
        '**/*.test.ts',
        '**/*.stories.ts', // documentation (Storybook), checked by its CI build
        '**/README.md',
        'server/api/**',
        'server/middleware/**',
        'server/routes/**',
        'server/plugins/**',
        'server/error-handler.ts',
        'server/db/migrations/**', // generated SQL and journals
        'scripts/cloud.mjs',
        'scripts/preview.mjs',
        'scripts/lighthouse.mjs',
        // Web Worker and its bridge (T-26b): WebAssembly encoders in a real browser, checked by upload-conversion.spec.ts;
        // the chain and the TGA decoder they run are tested separately
        'app/features/upload/convert/convert*.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 70,
        'shared/domain/**': { lines: 95, branches: 90 },
        'server/modules/*/domain/**': { lines: 95, branches: 90 },
        'server/modules/*/application/**': { lines: 90, branches: 85 },
        'app/components/ui/**': { lines: 90, branches: 80 },
      },
    },
  },
})
