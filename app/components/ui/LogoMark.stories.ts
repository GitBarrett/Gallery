import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import LogoMark from './LogoMark.vue'

const meta: Meta<typeof LogoMark> = {
  title: 'UI/Atoms/LogoMark',
  component: LogoMark,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `**Role**: sign the site (header, error pages, emails).

**When to use it**: full version in the header from 768 px; \`compact\` (emblem only) below.

**Avoid**: distorting, recolouring or redrawing the emblem; placing it on a photo without a scrim; translating the
name.

**Accessibility**: in the full version, the emblem is decorative and the text gives the name; in the compact version,
the emblem carries the name "Legendary Shots".`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof LogoMark>

export const Full: Story = {}
export const Compact: Story = { args: { compact: true } }
