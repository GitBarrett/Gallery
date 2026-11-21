import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import QuestMarker from './QuestMarker.vue'

const meta: Meta<typeof QuestMarker> = {
  title: 'UI/Atoms/QuestMarker',
  component: QuestMarker,
  tags: ['autodocs'],
  args: { kind: 'exclamation', label: 'New contest', done: false },
  argTypes: { kind: { control: 'inline-radio', options: ['exclamation', 'question'] } },
  parameters: {
    docs: {
      description: {
        component: `**Role**: a quest marker drawn in-house: "!" for news or a contest, "?" for an action to do; white once read
or done.

**When to use it**: the Quest log (notifications), the contest banner, a pending step. Its size follows the
surrounding text (\`em\`).

**Avoid**: the game's own sprites (never embedded); a marker as decoration with no meaning; more than one per item.

**Accessibility**: \`label\` is mandatory and names the image; the state (new, done) is also said in text next to
it, never by the colour alone.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof QuestMarker>

export const Exclamation: Story = {}
export const Question: Story = { args: { kind: 'question', label: 'Action to do' } }
export const ExclamationRead: Story = { args: { label: 'Read news', done: true } }
export const QuestionDone: Story = { args: { kind: 'question', label: 'Done', done: true } }
