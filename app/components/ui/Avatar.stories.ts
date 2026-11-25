import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import Avatar from './Avatar.vue'

const meta: Meta<typeof Avatar> = {
  title: 'UI/Atoms/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  args: { src: null, name: 'Ash_Barrett', size: 'sm' },
  parameters: {
    docs: {
      description: {
        component: `**Role**: show a member: the avatar they chose (square WebP, 64, 128 or 256 px) or the initial of
their username.

**When to use it**: \`sm\` (32 px) in the header and the lists, \`lg\` (112 px) on the profile and in the settings.
\`src\` is the base address given by the API (\`avatarUrl\`), the size is appended.

**Avoid**: using it without the username next to it or a labelled link around it; cropping or stretching it.

**Accessibility**: decorative (\`alt=""\`, initial hidden): the username is always written next to it or carried by
the link that holds it.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof Avatar>

export const Initial: Story = {}
export const InitialLarge: Story = { args: { size: 'lg' } }
// A missing image falls back to the initial (Storybook has no avatar route)
export const BrokenImage: Story = { args: { src: '/avatar/none/none', size: 'lg' } }
