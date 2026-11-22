// Wrangler configuration of a preview, derived from the production wrangler.toml (ADR-013, ADR-016).
// A preview must never touch a production resource: each expected replacement must find its line,
// and the result is refused if it still contains a production resource.

const SUBDOMAIN = 'aleygues.workers.dev'
const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA'

export function previewConfig(productionToml, { pr, hyperdriveId }) {
  const suffix = `-pr-${pr}`
  let toml = productionToml
  const replace = (pattern, replacement, label) => {
    if (!pattern.test(toml)) throw new Error(`wrangler.toml: ${label} not found`)
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
  // Turnstile test key (always passes, dummy token): the production widget only accepts the site's domain
  replace(
    /^NUXT_PUBLIC_TURNSTILE_SITE_KEY = .*$/m,
    `NUXT_PUBLIC_TURNSTILE_SITE_KEY = "${TURNSTILE_TEST_SITE_KEY}"`,
    'NUXT_PUBLIC_TURNSTILE_SITE_KEY',
  )
  replace(/^bucket_name = "ls-prod"$/m, 'bucket_name = "ls-preview"', 'bucket_name = "ls-prod"')
  replace(/(\[\[hyperdrive\]\]\nbinding = "HYPERDRIVE"\nid = )"[0-9a-f]+"/, `$1"${hyperdriveId}"`, 'hyperdrive')
  replace(/^namespace_id = "1001"$/m, 'namespace_id = "1002"', 'ratelimits namespace_id')
  replace(/^(queue|dead_letter_queue) = "([a-z-]+)"$/gm, `$1 = "$2${suffix}"`, 'queues')

  if (/ls-prod|legendary-shots/.test(toml)) throw new Error('the preview configuration still references production')
  const queues = [...new Set([...toml.matchAll(/^(?:queue|dead_letter_queue) = "([^"]+)"$/gm)].map((m) => m[1]))]
  return { toml, queues }
}

// Numbers of the pull requests that still own a resource: ls-pr-{n}, <queue>-pr-{n}, branch pr-{n}, R2 prefix pr-{n}/
export function previewNumbers(names) {
  return new Set(names.map((name) => /(?:^|-)pr-(\d+)\/?$/.exec(name)?.[1]).filter(Boolean))
}
