// Dependency rules of 10-clean-architecture.md § 2 and § 7 (`pnpm arch`), tested by tests/architecture.test.ts.
// Limit: Nuxt auto-imports (composables, components) are not `import`s and escape this check.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-pure',
      comment: 'The domain imports only its own domain, shared/domain and the standard library.',
      severity: 'error',
      from: { path: '^server/modules/([^/]+)/domain/', pathNot: '\\.test\\.ts$' }, // tests sit next to the code
      to: { pathNot: ['^server/modules/$1/domain/', '^shared/domain/'], dependencyTypesNot: ['core'] },
    },
    {
      name: 'application-no-tech',
      comment: 'The application knows neither infrastructure, nor interface, nor Drizzle, h3 or Nuxt.',
      severity: 'error',
      from: { path: '^server/modules/[^/]+/application/' },
      to: { path: ['/infrastructure/', '/interface/', 'node_modules/(drizzle-orm|h3|nuxt|nitropack|@nuxt)/'] },
    },
    {
      name: 'module-boundary',
      comment: "A module only imports another module's index.ts.",
      severity: 'error',
      from: { path: '^server/modules/([^/]+)/' },
      to: { path: '^server/modules/[^/]+/.+', pathNot: ['^server/modules/$1/', '^server/modules/[^/]+/index\\.ts$'] },
    },
    {
      name: 'api-thin',
      comment: 'Routes reach neither infrastructure nor the database.',
      severity: 'error',
      from: { path: '^server/api/' },
      to: { path: ['^server/modules/[^/]+/infrastructure/', '^server/db/'] },
    },
    {
      name: 'ui-pure',
      comment: 'The design system is pure presentation.',
      severity: 'error',
      from: { path: '^app/components/ui/' },
      to: { path: ['^app/services/', '^app/features/'] },
    },
    {
      name: 'pages-no-api',
      comment: 'Pages go through features, never through the API client.',
      severity: 'error',
      from: { path: '^app/pages/' },
      to: { path: '^app/services/api/' },
    },
    {
      name: 'shared-isolated',
      comment: 'shared/ is common to client and server, with no dependency on Nuxt.',
      severity: 'error',
      from: { path: '^shared/' },
      to: { path: ['^app/', '^server/', 'node_modules/(nuxt|nitropack|h3|@nuxt)/'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(tests/fixtures|\\.nuxt|\\.output)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: '.nuxt/tsconfig.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.mjs', '.js', '.vue', '.json'] },
  },
}
