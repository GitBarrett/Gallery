// Configuration wrangler d'une preview, dérivée du wrangler.toml de production (ADR-013, ADR-016).
// Une preview ne doit jamais toucher une ressource de production : chaque remplacement attendu doit
// trouver sa ligne, et le résultat est refusé s'il contient encore une ressource de production.

const SUBDOMAIN = 'aleygues.workers.dev'

export function previewConfig(productionToml, { pr, hyperdriveId }) {
  const suffix = `-pr-${pr}`
  let toml = productionToml
  const replace = (pattern, replacement, label) => {
    if (!pattern.test(toml)) throw new Error(`wrangler.toml : ${label} introuvable`)
    toml = toml.replace(pattern, replacement)
  }

  replace(/^name = "legendary-shots"$/m, `name = "ls-pr-${pr}"`, 'name')
  replace(
    /^NUXT_PUBLIC_SITE_URL = ".*"$/m,
    `NUXT_PUBLIC_SITE_URL = "https://ls-pr-${pr}.${SUBDOMAIN}"`,
    'NUXT_PUBLIC_SITE_URL',
  )
  replace(/^NUXT_DEPLOY_ENV = "production"$/m, 'NUXT_DEPLOY_ENV = "preview"', 'NUXT_DEPLOY_ENV')
  replace(/^NUXT_FAKE_PROVIDERS = "false"$/m, 'NUXT_FAKE_PROVIDERS = "true"', 'NUXT_FAKE_PROVIDERS')
  replace(/^NUXT_R2_PREFIX = ""$/m, `NUXT_R2_PREFIX = "pr-${pr}/"`, 'NUXT_R2_PREFIX')
  replace(/^bucket_name = "ls-prod"$/m, 'bucket_name = "ls-preview"', 'bucket_name = "ls-prod"')
  replace(/(\[\[hyperdrive\]\]\nbinding = "HYPERDRIVE"\nid = )"[0-9a-f]+"/, `$1"${hyperdriveId}"`, 'hyperdrive')
  replace(/^(queue|dead_letter_queue) = "([a-z-]+)"$/gm, `$1 = "$2${suffix}"`, 'queues')

  if (/ls-prod|legendary-shots/.test(toml))
    throw new Error('la configuration de preview référence encore la production')
  const queues = [...new Set([...toml.matchAll(/^(?:queue|dead_letter_queue) = "([^"]+)"$/gm)].map((m) => m[1]))]
  return { toml, queues }
}
