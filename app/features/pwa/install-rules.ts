// When to invite to install (07-design.md § Invitation à l'installation, US-63.2–3): never on the first visit; from
// the second visit or the first published capture; not again for 30 days once dismissed.
const QUIET = 30 * 24 * 60 * 60 * 1000

export function shouldOfferInstall(state: { visits: number; published: boolean; dismissedAt?: number; now: number }) {
  if (state.dismissedAt !== undefined && state.now - state.dismissedAt < QUIET) return false
  return state.visits >= 2 || state.published
}
