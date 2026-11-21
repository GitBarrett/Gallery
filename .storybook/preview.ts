import type { Preview } from '@storybook-vue/nuxt'

// Playbook d'abord, puis les composants du plus simple au plus composé (atomic design, ADR-019)
const preview: Preview = {
  parameters: {
    options: {
      storySort: {
        order: [
          'Playbook',
          ['Introduction et principes', 'Fondations', 'Accessibilité', 'Rédaction', 'Contribuer'],
          'UI',
          ['Atomes', 'Molécules'],
        ],
      },
    },
    a11y: { test: 'error' },
  },
}
export default preview
