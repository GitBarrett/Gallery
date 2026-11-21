import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import WowImage from './WowImage.vue'

const sky = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><defs><linearGradient id="s" x2="0" y2="1"><stop offset="0" stop-color="#140c2e"/><stop offset=".6" stop-color="#4b2a7a"/><stop offset="1" stop-color="#c06fd8"/></linearGradient></defs><rect width="1600" height="900" fill="url(#s)"/></svg>',
)}`

const meta: Meta<typeof WowImage> = {
  title: 'UI/Atoms/WowImage',
  component: WowImage,
  tags: ['autodocs'],
  args: { src: sky, alt: 'Suramar canals at dusk', width: 1600, height: 900, priority: false },
  parameters: {
    docs: {
      description: {
        component: `**Role**: a capture image, sized up front so the page never shifts while it loads.

**When to use it**: every capture shown on the site. Give \`priority\` to the single main image of the page (hero,
photo page) and to nothing else: it loads first, the others load lazily. For now it takes one \`src\`; the variant
widths (\`srcset\`) come with the image route.

**Avoid**: a plain \`<img>\` for a capture; an empty or generic \`alt\` ("image", the file name); text on the image
without an ImageScrim.

**Accessibility**: \`alt\` is mandatory and describes the scene (place, moment, subject).`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof WowImage>

export const Lazy: Story = {}
export const MainImage: Story = { args: { priority: true } }
