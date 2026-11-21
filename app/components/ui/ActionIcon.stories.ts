import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { h } from 'vue'
import ActionIcon from './ActionIcon.vue'

const heart = () =>
  h('svg', { viewBox: '0 0 24 24', fill: 'currentColor' }, [
    h('path', {
      d: 'M12 21s-7.5-4.6-9.5-9.3C1 8.2 3.4 4.5 7 4.5c2 0 3.6 1.1 5 2.8 1.4-1.7 3-2.8 5-2.8 3.6 0 6 3.7 4.5 7.2C19.5 16.4 12 21 12 21Z',
    }),
  ])

const meta: Meta<typeof ActionIcon> = {
  title: 'UI/Atoms/ActionIcon',
  component: ActionIcon,
  tags: ['autodocs'],
  args: { label: 'Like' },
  render: (args) => () => h(ActionIcon, args, heart),
  parameters: {
    docs: {
      description: {
        component: `**Role**: an action shown as an icon only (like, share, full screen, close, previous and next capture).

**When to use it**: a frequent action whose icon is universal, where text would crowd the screen (photo toolbar,
viewer, header of a modal). Give \`pressed\` for a toggle (Like), never for a one-shot action.

**Avoid**: an icon whose meaning has to be guessed (use a Button with text); several icon actions without spacing;
an icon placed straight on a photo without a scrim.

**Accessibility**: \`label\` is mandatory and becomes the accessible name and the hover tooltip; the icon is hidden
from screen readers; 44 × 44 px target; a toggle announces its state (\`aria-pressed\`).`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof ActionIcon>

export const Default: Story = {}
export const Pressed: Story = { args: { label: 'Unlike', pressed: true } }
export const Disabled: Story = { args: { disabled: true } }
