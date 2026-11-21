import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { h } from 'vue'
import Card from './Card.vue'

const meta: Meta<typeof Card> = {
  title: 'UI/Molecules/Card',
  component: Card,
  tags: ['autodocs'],
  args: { as: 'section' },
  render: (args) => () => h(Card, args, () => 'Captures, settings, page blocks'),
  parameters: {
    docs: {
      description: {
        component: `**Role**: group content on a framed surface.

**When to use it**: a block that stands out from the background (settings, capture card, inset). Pick the tag:
\`article\` for self-contained content (a capture), \`section\` for a titled block of the page, \`div\` otherwise.

**Avoid**: nested cards; a card around a single photo (captures first, interface in the background).

**Accessibility**: the semantic tag helps screen reader navigation; a \`section\` carries a heading.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof Card>

export const Section: Story = {}
export const Article: Story = { args: { as: 'article' } }
