import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { h } from 'vue'
import Button from './Button.vue'
import EmptyState from './EmptyState.vue'

const meta: Meta<typeof EmptyState> = {
  title: 'UI/Molécules/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  args: { title: 'Be the first to capture WoW Forever', description: 'No capture yet for this version.' },
  render: (args) => () => h(EmptyState, args, { action: () => h(Button, { to: '/upload' }, () => 'Upload a capture') }),
  parameters: {
    docs: {
      description: {
        component: `**Rôle** : remplacer un bloc qui serait vide (07-design.md § États vides et démarrage à froid).

**Quand l'utiliser** : dès qu'une liste, une grille ou un module n'a rien à montrer. Dire ce qui manque et proposer
l'action qui le comble (Upload, Explore). Pour soi : un appel à agir ; pour les autres : un constat sobre.

**À éviter** : un bloc vide, un « 0 », un message d'erreur pour un simple manque de contenu.

**Accessibilité** : le titre suit la hiérarchie de la page (\`headingLevel\`) ; l'icône éventuelle est décorative.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof EmptyState>

export const WithAction: Story = {}
export const ForOthers: Story = {
  args: { title: 'No captures yet', description: undefined, headingLevel: 3 },
  render: (args) => () => h(EmptyState, args),
}
