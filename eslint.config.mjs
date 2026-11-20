import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Prototypes jetables de la phase T-00 : conservés pour mémoire, jamais importés par l'application
  { ignores: ['prototypes/**', 'docs/**'] },
  {
    rules: {
      'vue/no-v-html': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
)
