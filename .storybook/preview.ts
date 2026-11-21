import type { Preview } from '@storybook-vue/nuxt'
import { themes } from 'storybook/theming'
import { h } from 'vue'

// Thème sombre et fond du site sous chaque story : les composants sont dessinés pour le fond nuit (07-design.md).
// Playbook d'abord, puis les composants du plus simple au plus composé (atomic design, ADR-019).
const preview: Preview = {
  decorators: [
    (story) => () => h('div', { style: 'background: var(--color-bg); padding: var(--space-6)' }, h(story())),
  ],
  parameters: {
    docs: { theme: themes.dark },
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
