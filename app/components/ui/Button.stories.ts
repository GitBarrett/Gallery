import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { h } from 'vue'
import Button from './Button.vue'

const meta: Meta<typeof Button> = {
  title: 'UI/Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  args: { variant: 'primary', size: 'md', disabled: false, block: false },
  argTypes: { variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost'] } },
  render: (args) => () => h(Button, args, () => 'Upload a capture'),
  parameters: {
    docs: {
      description: {
        component: `**Role**: trigger an action or lead to a page.

**When to use it**: \`primary\` for **a single** main action per screen (Upload, Sign in); \`secondary\` for supporting
actions (Explore, Filters); \`ghost\` for discreet actions in a list or a bar. With \`to\`, the button becomes a link:
the right form for navigation.

**Avoid**: two \`primary\` buttons side by side; a button holding only an icon (use ActionIcon, T-06b); a button that
navigates without \`to\`.

**Accessibility**: at least 44 px high (touch target); label always visible and explicit ("Upload a capture" rather
than "OK"); disabled, it stays a button and is no longer focusable; \`type="submit"\` only inside a form.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = {}
export const Secondary: Story = { args: { variant: 'secondary' } }
export const Ghost: Story = { args: { variant: 'ghost' } }
export const Large: Story = { args: { size: 'lg' } }
export const Disabled: Story = { args: { disabled: true } }
export const AsLink: Story = { args: { to: '/upload', variant: 'secondary' } }
export const FullWidth: Story = { args: { block: true } }
