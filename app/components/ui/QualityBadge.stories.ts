import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { h } from 'vue'
import { QUALITIES } from '../../../shared/domain/quality'
import QualityBadge from './QualityBadge.vue'

const names = { poor: 'Poor', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

const meta: Meta<typeof QualityBadge> = {
  title: 'UI/Atoms/QualityBadge',
  component: QualityBadge,
  tags: ['autodocs'],
  args: { quality: 'epic', label: 'Epic' },
  argTypes: { quality: { control: 'select', options: QUALITIES } },
  parameters: {
    docs: {
      description: {
        component: `**Role**: the quality tier of a capture, earned from its likes (Poor, Uncommon, Rare, Epic, Legendary).

**When to use it**: on a capture card, in the photo page and in rankings. Compute the tier with
\`qualityFromLikes(likes, thresholds)\` (\`shared/domain/quality.ts\`), the thresholds read from the site settings,
never written in the page.

**Avoid**: a colour without the badge; inventing a tier; hard-coding thresholds.

**Accessibility**: the tier name is always written (US-75.5), so colour is never the only signal; dark background
and border keep it readable on any photo.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof QualityBadge>

export const Epic: Story = {}

/** One badge per quality tier. */
export const AllTiers: Story = {
  render: () => () =>
    h(
      'div',
      QUALITIES.flatMap((quality) => [h(QualityBadge, { quality, label: names[quality] }), ' ']),
    ),
}
