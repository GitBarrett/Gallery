import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  { ignores: ['docs/**'] },
  {
    rules: {
      'vue/no-v-html': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      // Prettier écrit les éléments vides `<input />` : la règle suit Prettier, qui a le dernier mot sur la forme
      'vue/html-self-closing': ['warn', { html: { void: 'always', normal: 'never', component: 'always' } }],
    },
  },
  {
    // Design system : présentation pure. $fetch et useFetch sont injectés par Nuxt sans import,
    // dependency-cruiser ne les voit pas (10-clean-architecture.md § 7).
    files: ['app/components/ui/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...['$fetch', 'useFetch', 'useLazyFetch', 'useAsyncData'].map((name) => ({
          name,
          message: 'Le design system ne fait aucun appel réseau : passer la donnée par les props.',
        })),
      ],
    },
  },
  {
    files: ['server/modules/*/domain/**', 'server/modules/*/application/**'],
    rules: { complexity: ['error', 10] },
  },
)
