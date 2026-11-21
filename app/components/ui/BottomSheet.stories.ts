import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { h, ref } from 'vue'
import BottomSheet from './BottomSheet.vue'
import Button from './Button.vue'

const meta: Meta<typeof BottomSheet> = {
  title: 'UI/Molecules/BottomSheet',
  component: BottomSheet,
  tags: ['autodocs'],
  args: { title: 'Epic', closeLabel: 'Close' },
  render: (args) => ({
    setup() {
      const open = ref(false)
      return () => [
        h(Button, { variant: 'secondary', onClick: () => (open.value = true) }, () => `Open “${args.title}”`),
        h(
          BottomSheet,
          { ...args, open: open.value, 'onUpdate:open': (value: boolean) => (open.value = value) },
          {
            default: () => h('p', 'Epic · 500+ likes. The tier rises with the likes the capture receives.'),
            actions: args.full
              ? () => h(Button, { block: true, onClick: () => (open.value = false) }, () => 'Show 128 captures')
              : undefined,
          },
        ),
      ]
    },
  }),
  parameters: {
    docs: {
      description: {
        component: `**Role**: on mobile, show content tied to an element of the page without leaving it: the tooltip of
a quality badge or an item (US-67.3), the PLP filters in full screen (\`full\`, US-67.4).

**When to use it**: below 768 px, in place of a hover tooltip or a side panel; from 768 px, the same content shows
as a tooltip or a bar (07-design.md § Responsive).

**Avoid**: a sheet taller than the screen without need (prefer \`full\`), a sheet for a decision that blocks
everything (Modal), stacked sheets.

**Accessibility**: the same as the Modal it is built on: focus trapped, Escape and the backdrop close it, focus back
to the opener (US-75.2); the content leaves room for the home indicator (safe area).`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof BottomSheet>

export const Tooltip: Story = {}
export const FullScreenFilters: Story = { args: { title: 'Filters', full: true } }
