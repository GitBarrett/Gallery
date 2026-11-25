import { describe, expect, it } from 'vitest'
import type { ModerationProvider } from '../../server/modules/moderation'

// Contract of the ModerationProvider port (11-strategie-de-tests.md § 4): checked on the fake and on Sightengine
// with recorded answers. `make` returns a provider whose next answer is a safe image.
export function moderationProviderContract(name: string, make: () => ModerationProvider) {
  describe(`ModerationProvider contract: ${name}`, () => {
    it('US-50.6 scores a safe image under the low threshold, with its raw answer', async () => {
      const found = await make().check(new Uint8Array([0xff, 0xd8, 0xff]), { title: 'Dawn on the Plains' })
      expect(found.score).toBeGreaterThanOrEqual(0)
      expect(found.score).toBeLessThan(0.5)
      expect(found.raw).toBeTypeOf('object')
    })
  })
}
