import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { h, ref } from 'vue'
import Button from './Button.vue'
import Input from './Input.vue'
import Modal from './Modal.vue'

const meta: Meta<typeof Modal> = {
  title: 'UI/Molecules/Modal',
  component: Modal,
  tags: ['autodocs'],
  args: { title: 'Report a bug', closeLabel: 'Close' },
  // A modal opens from a control: the story shows that control, and the dialog once it is pressed.
  render: (args) => ({
    setup() {
      const open = ref(false)
      return () => [
        h(Button, { variant: 'secondary', onClick: () => (open.value = true) }, () => 'Report a bug'),
        h(
          Modal,
          { ...args, open: open.value, 'onUpdate:open': (value: boolean) => (open.value = value) },
          {
            default: () => h(Input, { label: 'What happened?', hint: 'Steps, page, what you expected.' }),
            actions: () => [
              h(Button, { variant: 'ghost', onClick: () => (open.value = false) }, () => 'Cancel'),
              h(Button, { onClick: () => (open.value = false) }, () => 'Send the report'),
            ],
          },
        ),
      ]
    },
  }),
  parameters: {
    docs: {
      description: {
        component: `**Role**: a short task or a decision that interrupts the page (report a bug, confirm a deletion).

**When to use it**: the task fits on one screen and the user comes back to the page afterwards. Title it with what
the dialog does; put the main action last in \`actions\`, the way out (Cancel) before it. On mobile, prefer the
BottomSheet for content tied to an element of the page.

**Avoid**: a modal for content that deserves a page (a form of several steps, a capture), a modal opened without a
user action, a modal over a modal.

**Accessibility**: native \`<dialog>\`: the page behind is inert, focus moves into the dialog (first field marked
\`autofocus\`, otherwise the close button), Tab stays inside, Escape and a click on the backdrop close it, and focus
returns to the control that opened it (US-75.2). Opening and closing are instant when the user reduces motion.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof Modal>

export const Default: Story = {}
