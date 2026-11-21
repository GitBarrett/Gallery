import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { h } from 'vue'
import ImageScrim from './ImageScrim.vue'
import WowImage from './WowImage.vue'

// Worst cases for readability: a pure white and a pure black "photo".
const plain = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="${fill}"/></svg>`)}`

const meta: Meta<typeof ImageScrim> = {
  title: 'UI/Molecules/ImageScrim',
  component: ImageScrim,
  tags: ['autodocs'],
  args: { level: 'default' },
  argTypes: { level: { control: 'inline-radio', options: ['default', 'max'] } },
  render: (args) => () =>
    h(ImageScrim, args, {
      default: () => h(WowImage, { src: plain('#fff'), alt: 'A plain white capture', width: 800, height: 450 }),
      caption: () => [h('strong', 'Arcane Dusk'), h('div', 'by Lunelame · Suramar')],
    }),
  parameters: {
    docs: {
      description: {
        component: `**Role**: the veil between a photo and the text laid on it (title, author, hero call to action).

**When to use it**: every time text sits on a capture. Put the image in the default slot and the text in
\`caption\`; it lands bottom-left. Choose \`max\` for bright photos (luma above 0.6, measured at upload).

**Avoid**: text straight on a photo; a \`text-shadow\` instead of the veil; centred text over the image.

**Accessibility**: the veil is dark enough for AA contrast (4.5:1) even over a pure white or pure black area,
checked by the component test on the tokens.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof ImageScrim>

/** Over the brightest possible photo. */
export const OnWhite: Story = {}
export const OnWhiteMax: Story = { args: { level: 'max' } }

/** Over the darkest possible photo. */
export const OnBlack: Story = {
  render: (args) => () =>
    h(ImageScrim, args, {
      default: () => h(WowImage, { src: plain('#000'), alt: 'A plain black capture', width: 800, height: 450 }),
      caption: () => [h('strong', 'Arcane Dusk'), h('div', 'by Lunelame · Suramar')],
    }),
}
