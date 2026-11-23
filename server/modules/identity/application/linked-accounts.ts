import { err, ok } from '../../../../shared/domain/result'
import type { UnitOfWork } from '../../../platform/unit-of-work'
import { accountOf } from './email-change'
import type { IdentityResult } from './email-tokens'
import type { IdentityRepository, OAuthProviderName } from './ports'

/**
 * Unlinks a Google or Battle.net account from the signed-in member (US-07.4), own account only (08-securite.md
 * annexe B, row "Compte"); a provider not linked to it is not found. Refused when no sign-in method would remain: no
 * password and no other provider. Checked and deleted in one transaction, so two unlinks at once cannot both pass.
 */
export const unlinkOAuth =
  (deps: { uow: UnitOfWork<IdentityRepository> }) =>
  async (cmd: { userId: string; provider: OAuthProviderName }): Promise<IdentityResult> =>
    deps.uow.run(async (repo) => {
      const providers = await repo.listOAuthProviders(cmd.userId)
      if (!providers.includes(cmd.provider)) return err({ kind: 'not_found' })
      const { passwordHash } = await accountOf(repo, cmd.userId)
      if (!passwordHash && providers.length === 1) return err({ kind: 'forbidden', reason: 'last_sign_in_method' })
      await repo.unlinkOAuthAccount(cmd.userId, cmd.provider)
      return ok(undefined)
    })
