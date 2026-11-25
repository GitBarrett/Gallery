import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import WowImage from './WowImage.vue'

const meta: Meta<typeof WowImage> = {
  title: 'UI/Atoms/WowImage',
  component: WowImage,
  tags: ['autodocs'],
  args: {
    photoId: '0193a000-0000-7000-8000-0000000000aa',
    alt: 'Suramar canals at dusk, captured by Lunelame',
    width: 1600,
    height: 900,
    priority: false,
    preview: false,
  },
  parameters: {
    docs: {
      description: {
        component: `**Role**: a capture image, sized up front so the page never shifts while it loads. It takes the
capture's id and offers its stored WebP widths (400, 800, 1200, 2400 px) from \`/img\`; the browser picks one from
\`sizes\`, the width of the image in its grid.

**When to use it**: every capture shown on the site. Give \`priority\` to the single main image of the page (hero,
photo page) and to nothing else: it loads first, the others load lazily. Set \`sizes\` to the grid's columns
(default: 4 columns from 1024 px, 3 from 640 px, else 2). \`preview\` only for the author's « My captures » and the
moderation, on a capture not yet published.

**Avoid**: a plain \`<img>\` for a capture; an empty or generic \`alt\` ("image", the file name); text on the image
without an ImageScrim; a preview of a published capture (it would skip the browser and edge cache).

**Accessibility**: \`alt\` is mandatory: « {title} — {zone}, captured by {author} », or the author's own text.

Storybook has no \`/img\` route: the image does not load here, the \`srcset\` shows in the DOM.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof WowImage>

export const Lazy: Story = {}
export const MainImage: Story = { args: { priority: true, sizes: '100vw' } }
export const PrivatePreview: Story = { args: { preview: true } }
