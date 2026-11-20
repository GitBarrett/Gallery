import { z } from 'zod'

// Variables validées au démarrage ; chaque tâche ajoute les siennes (03-architecture.md § Configuration et secrets).
const schema = z.object({
  NUXT_PUBLIC_SITE_URL: z.url(),
  NUXT_FAKE_PROVIDERS: z.enum(['true', 'false']).default('false'),
})

export interface Config {
  siteUrl: string
  fakeProviders: boolean
}

/** Valide l'environnement ; une variable manquante ou invalide fait échouer le démarrage, sans afficher sa valeur. */
export function loadConfig(env: Record<string, string | undefined>): Config {
  const parsed = schema.safeParse(env)
  if (!parsed.success) {
    const names = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))]
    throw new Error(`Configuration invalide ou manquante : ${names.join(', ')}`)
  }
  return { siteUrl: parsed.data.NUXT_PUBLIC_SITE_URL, fakeProviders: parsed.data.NUXT_FAKE_PROVIDERS === 'true' }
}
