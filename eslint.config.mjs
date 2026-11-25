import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  { ignores: ['docs/**'] },
  {
    rules: {
      'vue/no-v-html': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // Prettier writes void elements as `<input />`: the rule follows Prettier, which has the last word on form
      'vue/html-self-closing': ['warn', { html: { void: 'always', normal: 'never', component: 'always' } }],
    },
  },
  {
    // Design system: pure presentation. $fetch and useFetch are injected by Nuxt without an import,
    // so dependency-cruiser cannot see them (10-clean-architecture.md § 7).
    files: ['app/components/ui/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['$fetch', 'useFetch', 'useLazyFetch', 'useAsyncData'].map((name) => ({
          name,
          message: 'The design system makes no network call: pass the data through props.',
        })),
      ],
    },
  },
  {
    files: ['server/modules/*/domain/**', 'server/modules/*/application/**'],
    rules: { complexity: ['error', 10] },
  },
  {
    // E2E on previews behind Cloudflare Access: the forms that made CI runs fail (analysis of 25/11/2026)
    files: ['tests/e2e/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='request'][object.name=/^(page|context)$/]",
          message: 'Cloudflare Access answers a bare request with its own page: check from the page (helpers.ts).',
        },
        {
          selector: "ObjectPattern > Property[key.name='request']",
          message: 'Cloudflare Access answers a bare request with its own page: check from the page (helpers.ts).',
        },
        {
          selector:
            "CallExpression[callee.object.name='page'][callee.property.name='getByRole'][arguments.0.value=/^(status|alert)$/]:not(MemberExpression[property.name='filter'] > CallExpression.object)",
          message: 'Several status or alert regions can show at once: add .filter({ hasText }) or scope the locator.',
        },
        {
          selector: "CallExpression[callee.property.name='waitForLoadState'][arguments.0.value='networkidle']",
          message: 'networkidle hangs on polling pages and does not mean hydrated: await hydrated(page) (helpers.ts).',
        },
      ],
    },
  },
)
