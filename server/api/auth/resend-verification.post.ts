import { ResendVerificationBody } from '../../../shared/contracts/auth'
import { orThrow } from '../../modules/identity'
import { requireContext } from '../../platform/auth-context'

// New verification link (US-01.5) for the signed-in member (08-securite.md annexe B); 204 even when verified.
export default defineEventHandler(async (event) => {
  const { container, actor } = await requireContext(event)
  const body = await readValidatedBody(event, ResendVerificationBody.parse)
  orThrow(await container.identity.resendVerification({ ...body, actor, ip: getHeader(event, 'cf-connecting-ip') }))
  return sendNoContent(event)
})
