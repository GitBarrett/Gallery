import { fetch, setup } from '@nuxt/test-utils/e2e'
import { describe, expect, it } from 'vitest'

process.env.NUXT_PUBLIC_SITE_URL = 'http://localhost:3000'
await setup({ server: true, browser: false })

const localeCookie = async (path: string) =>
  (await fetch(path, { headers: { accept: 'text/html' } })).headers
    .getSetCookie()
    .find((cookie) => cookie.startsWith('i18n_redirected='))

describe('language cookie (US-62)', () => {
  it('US-62.1 the offline pages precached by the service worker never change the language', async () => {
    expect(await localeCookie('/offline')).toBeUndefined()
    expect(await localeCookie('/fr/offline')).toBeUndefined()
  })

  it('US-62.2 reading a French page still remembers French', async () => {
    expect(await localeCookie('/fr/terms')).toMatch(/^i18n_redirected=fr;/)
  })
})
