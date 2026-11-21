import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import Input from './Input.vue'

const meta: Meta<typeof Input> = {
  title: 'UI/Atomes/Input',
  component: Input,
  tags: ['autodocs'],
  args: { label: 'Email', type: 'email' },
  parameters: {
    docs: {
      description: {
        component: `**Rôle** : saisir une valeur courte (email, pseudo, titre, zone).

**Quand l'utiliser** : tout champ texte d'un formulaire, avec \`v-model\`. Donner le bon \`type\` et \`autocomplete\`
(email, username, current-password, new-password) : le clavier mobile et le gestionnaire de mots de passe en
dépendent.

**À éviter** : un champ sans libellé visible ; un placeholder à la place du libellé ; une erreur signalée seulement
par la couleur de la bordure.

**Accessibilité** : le libellé est relié au champ ; l'aide et l'erreur sont annoncées par \`aria-describedby\` et
\`aria-invalid\` ; l'astérisque des champs obligatoires est décoratif, \`required\` porte l'information.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof Input>

export const Default: Story = {}
export const WithHint: Story = { args: { label: 'Password', type: 'password', hint: '12 characters minimum' } }
export const Required: Story = { args: { label: 'Username', type: 'text', required: true } }
export const WithError: Story = {
  args: { label: 'Password', type: 'password', hint: '12 characters minimum', error: 'Too short' },
}
