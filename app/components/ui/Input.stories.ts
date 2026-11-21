import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import Input from './Input.vue'

const meta: Meta<typeof Input> = {
  title: 'UI/Atoms/Input',
  component: Input,
  tags: ['autodocs'],
  args: { label: 'Email', type: 'email' },
  parameters: {
    docs: {
      description: {
        component: `**Role**: enter a short value (email, username, title, zone).

**When to use it**: any text field of a form, with \`v-model\`. Give the right \`type\` and \`autocomplete\` (email,
username, current-password, new-password): the mobile keyboard and the password manager depend on them.

**Avoid**: a field without a visible label; a placeholder instead of the label; an error shown only by the colour of
the border.

**Accessibility**: the label is tied to the field; hint and error are announced through \`aria-describedby\` and
\`aria-invalid\`; the asterisk of required fields is decorative, \`required\` carries the information.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {}
export const WithHint: Story = { args: { label: 'Password', type: 'password', hint: '12 characters minimum' } }
export const Required: Story = { args: { label: 'Username', type: 'text', required: true } }
export const WithError: Story = {
  args: { label: 'Password', type: 'password', hint: '12 characters minimum', error: 'Too short' },
}
