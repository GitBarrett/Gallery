import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { h } from 'vue'
import Toast from './Toast.vue'

const meta: Meta<typeof Toast> = {
  title: 'UI/Molecules/Toast',
  component: Toast,
  tags: ['autodocs'],
  args: { open: true, message: 'A new version is available', actionLabel: 'Reload', dismissLabel: 'Dismiss' },
  render: (args) => () => h(Toast, args),
  parameters: {
    docs: {
      story: { inline: false, iframeHeight: 120 },
      description: {
        component: `**Role**: a short message about something that happened elsewhere than where the user looks: a new
version of the site (US-65.1), a link copied.

**When to use it**: the information is useful but does not block anything. One action at most, named by a verb
("Reload"); the message stays until it is acted on or dismissed.

**Avoid**: a toast for a form error (show it next to the field), for important information that must not be
missed (a page or a Modal), several toasts at once.

**Accessibility**: polite live region (\`role="status"\`) present before the message so it is announced without
moving focus; the dismiss button is named; no timer, so slow readers do not lose it.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof Toast>

export const WithAction: Story = {}
export const MessageOnly: Story = { args: { message: 'Link copied', actionLabel: undefined } }
