import type { ModerationProvider } from '../application/ports'

// Scores of the fake provider (11-strategie-de-tests.md § Fakes), read from the capture's title: local runs, tests and
// previews (NUXT_FAKE_PROVIDERS), never production (config). `…_nsfw` is rejected, `…_review` goes to review,
// `…_down` makes the provider fail (US-50.4); any other title is published.
const SCORES: [suffix: string, score: number][] = [
  ['_nsfw', 0.95],
  ['_review', 0.6],
]

export const fakeModerationProvider = (): ModerationProvider => ({
  async check(_image, { title }) {
    const name = (title ?? '').toLowerCase()
    if (name.endsWith('_down')) throw new Error('fake moderation provider down')
    const score = SCORES.find(([suffix]) => name.endsWith(suffix))?.[1] ?? 0.02
    return { score, raw: { fake: true, score } }
  },
})
