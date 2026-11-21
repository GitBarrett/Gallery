import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { h } from 'vue'
import Button from './Button.vue'
import EmptyState from './EmptyState.vue'

const meta: Meta<typeof EmptyState> = {
  title: 'UI/Molecules/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  args: { title: 'Be the first to capture WoW Forever', description: 'No capture yet for this version.' },
  render: (args) => () => h(EmptyState, args, { action: () => h(Button, { to: '/upload' }, () => 'Upload a capture') }),
  parameters: {
    docs: {
      description: {
        component: `**Role**: replace a block that would be empty (07-design.md § États vides et démarrage à froid).

**When to use it**: as soon as a list, a grid or a module has nothing to show. Say what is missing and offer the
action that fills it (Upload, Explore). For oneself: a call to act; for others: a sober statement.

**Avoid**: an empty block, a "0", an error message for a mere lack of content.

**Accessibility**: the heading follows the page hierarchy (\`headingLevel\`); the optional icon is decorative.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof EmptyState>

export const WithAction: Story = {}
export const ForOthers: Story = {
  args: { title: 'No captures yet', description: undefined, headingLevel: 3 },
  render: (args) => () => h(EmptyState, args),
}
