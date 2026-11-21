import { describe, expect, it } from 'vitest'
import type { UnitOfWork } from '../../server/platform/unit-of-work'

/** Une implémentation à tester, avec les messages reçus par les files et une file qui peut refuser l'envoi. */
export interface UnitOfWorkHarness {
  uow: UnitOfWork<object>
  sent(): { topic: string; payload: unknown }[]
}

// Contrat du port UnitOfWork (11-strategie-de-tests.md § 4) : vérifié sur l'implémentation Drizzle et sur le fake.
export function unitOfWorkContract(
  name: string,
  make: (options: { queueFails: boolean }) => Promise<UnitOfWorkHarness>,
) {
  describe(`UnitOfWork contract: ${name}`, () => {
    it('returns the result of the work', async () => {
      const { uow } = await make({ queueFails: false })
      expect(await uow.run(async () => 42)).toBe(42)
    })

    it('publishes the recorded events after the commit', async () => {
      const { uow, sent } = await make({ queueFails: false })
      await uow.run(async (_, publish) => {
        publish({ topic: 'notifications', payload: { kind: 'contract', n: 1 } })
        expect(sent()).toEqual([]) // rien ne part avant le commit
      })
      expect(sent()).toEqual([{ topic: 'notifications', payload: { kind: 'contract', n: 1 } }])
    })

    it('publishes nothing when the work fails', async () => {
      const { uow, sent } = await make({ queueFails: false })
      await expect(
        uow.run(async (_, publish) => {
          publish({ topic: 'emails', payload: { kind: 'contract' } })
          throw new Error('business failure')
        }),
      ).rejects.toThrow('business failure')
      expect(sent()).toEqual([])
    })

    it('still succeeds when the queue refuses the event after the commit', async () => {
      const { uow } = await make({ queueFails: true })
      const result = await uow.run(async (_, publish) => {
        publish({ topic: 'notifications', payload: { kind: 'contract' } })
        return 'saved'
      })
      expect(result).toBe('saved')
    })
  })
}
