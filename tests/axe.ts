import axe from 'axe-core'

/**
 * Violations axe-core d'un composant monté (11-strategie-de-tests.md : aucune violation « serious » ou « critical »).
 * Le contraste n'est pas calculable sans moteur de rendu : il est vérifié sur les tokens (design-tokens.test.ts) et
 * par Playwright sur les pages. `region` exige une page complète, hors sujet pour un composant isolé.
 */
export async function axeViolations(element: Element): Promise<string[]> {
  const host = document.createElement('main')
  host.appendChild(element.cloneNode(true))
  document.body.appendChild(host)
  try {
    const { violations } = await axe.run(host, {
      rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
    })
    return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.help}`)
  } finally {
    host.remove()
  }
}
