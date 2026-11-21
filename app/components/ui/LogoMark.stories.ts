import type { Meta, StoryObj } from '@storybook-vue/nuxt'
import LogoMark from './LogoMark.vue'

const meta: Meta<typeof LogoMark> = {
  title: 'UI/Atomes/LogoMark',
  component: LogoMark,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `**Rôle** : signer le site (header, pages d'erreur, emails).

**Quand l'utiliser** : version complète dans le header à partir de 768 px ; \`compact\` (emblème seul) en dessous.

**À éviter** : déformer, recolorer ou redessiner l'emblème ; le poser sur une photo sans voile ; traduire le nom.

**Accessibilité** : en version complète, l'emblème est décoratif et le texte donne le nom ; en version compacte,
l'emblème porte le nom « Legendary Shots ».`,
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof LogoMark>

export const Full: Story = {}
export const Compact: Story = { args: { compact: true } }
