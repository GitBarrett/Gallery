import axe from 'axe-core'

/**
 * axe-core violations of a mounted component (11-strategie-de-tests.md: no "serious" or "critical" violation).
 * Contrast cannot be computed without a rendering engine: it is checked on the tokens (design-tokens.test.ts) and
 * by Playwright on pages. `region` needs a full page, off-topic for an isolated component.
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
