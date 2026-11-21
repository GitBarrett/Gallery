import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

// Base de test locale (branche Neon dev-…) : DATABASE_URL dans .env.test, ignoré par git ; en CI, service Postgres
if (existsSync('.env.test')) process.loadEnvFile('.env.test')

// Trois projets (11-strategie-de-tests.md § 1).
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
          testTimeout: 30_000, // vraie base (Neon en local) : création de bases et migrations
          include: ['server/**/*.int.test.ts', 'tests/api/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      // Pages, layouts et app.vue sont fins et couverts par les E2E (10-clean-architecture.md § 6)
      include: [
        'scripts/**',
        'shared/**',
        'server/**',
        'app/components/**',
        'app/features/**',
        'app/composables/**',
        'app/services/**',
      ],
      // Colle Nitro (routes, middlewares, plugins, gestionnaire d'erreurs) : exécutée dans le serveur des tests
      // d'intégration. scripts/cloud.mjs, preview.mjs et lighthouse.mjs : appels d'API, de wrangler et de navigateur, vérifiés
      // sur de vraies previews (T-03b, T-04b) ; leurs règles pures sont testées à part.
      exclude: [
        '**/*.test.ts',
        '**/*.stories.ts', // documentation (Storybook), vérifiée par son build en CI
        '**/README.md',
        'server/api/**',
        'server/middleware/**',
        'server/routes/**',
        'server/plugins/**',
        'server/error-handler.ts',
        'server/db/migrations/**', // SQL et journaux générés
        'scripts/cloud.mjs',
        'scripts/preview.mjs',
        'scripts/lighthouse.mjs',
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
