// The service worker precaches /offline and /fr/offline when it installs (T-09a): those responses must not write the
// language cookie, or every visitor would switch to the language of the last page cached (fr) on their next visit to /.
const OFFLINE_PAGE = /^(\/fr)?\/offline\/?(\?|$)/

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    if (!OFFLINE_PAGE.test(event.path)) return
    const cookies = [event.node.res.getHeader('set-cookie') ?? []].flat().map(String)
    const kept = cookies.filter((cookie) => !cookie.startsWith('i18n_redirected='))
    if (kept.length) event.node.res.setHeader('set-cookie', kept)
    else event.node.res.removeHeader('set-cookie')
  })
})
