import { expect, it } from 'vitest'

// DÉMO T-04a : test vert, mais le code de demo-ci.ts reste non couvert (seuil de shared/domain)
it('fails on purpose', () => {
  expect(1 + 1).toBe(2)
})
