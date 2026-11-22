// US-79.2: greeting in the browser console, in production as in previews.
import { greetOnce } from '~/features/surprises/console-greeting'

export default defineNuxtPlugin((nuxtApp) => {
  const { t } = nuxtApp.$i18n
  const feedback = new URL(useLocalePath()('/feedback'), window.location.origin).href
  greetOnce({
    storage: () => window.sessionStorage,
    // globalThis.console: nuxt-security strips plain `console.*` calls from production builds
    log: (message) => globalThis.console.info(message),
    line: t('surprises.console', { link: feedback }),
  })
})
