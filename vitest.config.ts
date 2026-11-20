import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

// Trois projets (11-strategie-de-tests.md § 1) ; prototypes/ hors périmètre (T-00, jamais importés).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['shared/**/*.test.ts', 'server/**/*.test.ts', 'scripts/**/*.test.ts'],
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
          include: ['server/**/*.int.test.ts', 'tests/api/**/*.test.ts'],
          // shortcut: `test:int` passe sans test (--passWithNoTests) jusqu'à la base (T-05a) ; retirer alors l'option du script
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
      exclude: ['**/*.test.ts', '**/README.md'],
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
