import type { Preview } from '@storybook-vue/nuxt'
import { themes } from 'storybook/theming'
import { h } from 'vue'

// Dark theme and the site background under every story: components are drawn for the night background (07-design.md).
// Playbook first, then components from the simplest to the most composed (atomic design, ADR-019).
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
          ['Introduction and principles', 'Foundations', 'Accessibility', 'Writing', 'Contributing'],
          'UI',
          ['Atoms', 'Molecules'],
        ],
      },
    },
    a11y: { test: 'error' },
  },
}
export default preview
