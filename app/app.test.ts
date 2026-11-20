import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import App from './app.vue'

// Test de fumée du projet `component` : l'environnement Nuxt monte l'application et sa page d'accueil.
describe('app', () => {
  it('renders the home page shell', async () => {
    const wrapper = await mountSuspended(App, { route: '/' })
    expect(wrapper.find('main').exists()).toBe(true)
  })
})
