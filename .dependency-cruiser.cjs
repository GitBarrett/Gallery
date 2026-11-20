// Règles de dépendance de 10-clean-architecture.md § 2 et § 7 (`pnpm arch`), testées par tests/architecture.test.ts.
// Limite : les imports automatiques de Nuxt (composables, composants) ne sont pas des `import` et échappent à ce contrôle.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-pure',
      comment: "Le domaine n'importe que son propre domaine, shared/domain et la bibliothèque standard.",
      severity: 'error',
      from: { path: '^server/modules/([^/]+)/domain/' },
      to: { pathNot: ['^server/modules/$1/domain/', '^shared/domain/'], dependencyTypesNot: ['core'] },
    },
    {
      name: 'application-no-tech',
      comment: "L'application ne connaît ni l'infrastructure, ni l'interface, ni Drizzle, h3 ou Nuxt.",
      severity: 'error',
      from: { path: '^server/modules/[^/]+/application/' },
      to: { path: ['/infrastructure/', '/interface/', 'node_modules/(drizzle-orm|h3|nuxt|nitropack|@nuxt)/'] },
    },
    {
      name: 'module-boundary',
      comment: "Un module n'importe que l'index.ts d'un autre module.",
      severity: 'error',
      from: { path: '^server/modules/([^/]+)/' },
      to: { path: '^server/modules/[^/]+/.+', pathNot: ['^server/modules/$1/', '^server/modules/[^/]+/index\\.ts$'] },
    },
    {
      name: 'api-thin',
      comment: "Les routes n'accèdent ni à l'infrastructure ni à la base.",
      severity: 'error',
      from: { path: '^server/api/' },
      to: { path: ['^server/modules/[^/]+/infrastructure/', '^server/db/'] },
    },
    {
      name: 'ui-pure',
      comment: 'Le design system est de la présentation pure.',
      severity: 'error',
      from: { path: '^app/components/ui/' },
      to: { path: ['^app/services/', '^app/features/'] },
    },
    {
      name: 'pages-no-api',
      comment: 'Les pages passent par les features, jamais par le client API.',
      severity: 'error',
      from: { path: '^app/pages/' },
      to: { path: '^app/services/api/' },
    },
    {
      name: 'shared-isolated',
      comment: 'shared/ est commun au client et au serveur, sans dépendance à Nuxt.',
      severity: 'error',
      from: { path: '^shared/' },
      to: { path: ['^app/', '^server/', 'node_modules/(nuxt|nitropack|h3|@nuxt)/'] },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(prototypes|tests/fixtures|\\.nuxt|\\.output)/' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: '.nuxt/tsconfig.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.mjs', '.js', '.vue', '.json'] },
  },
}
