import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { h } from 'vue'
import Card from './Card.vue'

const meta: Meta<typeof Card> = {
  title: 'UI/Molécules/Card',
  component: Card,
  tags: ['autodocs'],
  args: { as: 'section' },
  render: (args) => () => h(Card, args, () => 'Captures, settings, page blocks'),
  parameters: {
    docs: {
      description: {
        component: `**Rôle** : regrouper un contenu sur une surface encadrée.

**Quand l'utiliser** : un bloc qui se distingue du fond (réglages, carte de capture, encart). Choisir la balise :
\`article\` pour un contenu autonome (une capture), \`section\` pour un bloc titré de la page, \`div\` sinon.

**À éviter** : des cartes imbriquées ; une carte autour d'une photo seule (les photos priment, UI en retrait).

**Accessibilité** : la balise sémantique aide la navigation au lecteur d'écran ; une \`section\` porte un titre.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof Card>

export const Section: Story = {}
export const Article: Story = { args: { as: 'article' } }
