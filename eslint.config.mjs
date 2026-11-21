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
)
