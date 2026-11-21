import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { h } from 'vue'
import ItemTooltip from './ItemTooltip.vue'

const meta: Meta<typeof ItemTooltip> = {
  title: 'UI/Molecules/ItemTooltip',
  component: ItemTooltip,
  tags: ['autodocs'],
  args: {
    title: 'Arcane Dusk',
    quality: 'epic',
    use: 'Use: download the original as a wallpaper.',
    caption: '“The canals glow brighter than the stars.”',
    credit: 'Captured by @Lunelame',
  },
  render: (args) => () =>
    h(ItemTooltip, args, () => [
      h('div', 'Epic capture · WoW Forever'),
      h('div', 'Suramar · 23:40 in-game'),
      h('div', '5120 × 2160'),
    ]),
  parameters: {
    docs: {
      description: {
        component: `**Role**: the details of a capture shown like an in-game item: title in the quality colour, details
(slot), green "Use:" line for the main action, the author's caption in yellow italic, then the credit.

**When to use it**: hovering or focusing a capture on desktop; on touch, put the same panel inside a BottomSheet
(US-67.3). This component is the panel only: the caller decides when it shows.

**Avoid**: long paragraphs; more than one "Use:" line; information that exists nowhere else (the tooltip must not
be the only way to reach it).

**Accessibility**: white text on a near-opaque night-blue panel; link the trigger to the panel with
\`aria-describedby\` and show it on keyboard focus as well as on hover.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof ItemTooltip>

export const Full: Story = {}
export const TitleOnly: Story = {
  args: { quality: 'poor', title: 'Snowy pass', use: undefined, caption: undefined, credit: undefined },
  render: (args) => () => h(ItemTooltip, args),
}
