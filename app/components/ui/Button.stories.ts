import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import { h } from 'vue'
import Button from './Button.vue'

const meta: Meta<typeof Button> = {
  title: 'UI/Atomes/Button',
  component: Button,
  tags: ['autodocs'],
  args: { variant: 'primary', size: 'md', disabled: false, block: false },
  argTypes: { variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost'] } },
  render: (args) => () => h(Button, args, () => 'Upload a capture'),
  parameters: {
    docs: {
      description: {
        component: `**Rôle** : déclencher une action ou mener à une page.

**Quand l'utiliser** : \`primary\` pour **une seule** action principale par écran (Upload, Sign in) ; \`secondary\`
pour les actions d'accompagnement (Explore, Filters) ; \`ghost\` pour les actions discrètes dans une liste ou une
barre. Avec \`to\`, le bouton devient un lien : c'est la bonne forme pour une navigation.

**À éviter** : deux boutons \`primary\` côte à côte ; un bouton qui ne contient qu'une icône (prendre ActionIcon,
T-06b) ; un bouton pour naviguer sans \`to\`.

**Accessibilité** : hauteur de 44 px au moins (cible tactile) ; libellé toujours visible et explicite (« Upload a
capture » plutôt que « OK ») ; désactivé, il reste un bouton et n'est plus focalisable ; \`type="submit"\` seulement
dans un formulaire.`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = {}
export const Secondary: Story = { args: { variant: 'secondary' } }
export const Ghost: Story = { args: { variant: 'ghost' } }
export const Large: Story = { args: { size: 'lg' } }
export const Disabled: Story = { args: { disabled: true } }
export const AsLink: Story = { args: { to: '/upload', variant: 'secondary' } }
export const FullWidth: Story = { args: { block: true } }
