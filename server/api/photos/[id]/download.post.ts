import { PhotoParams, type DownloadResponse } from '../../../../shared/contracts/photos'
import { orThrow } from '../../../modules/media'
import { requireContext } from '../../../platform/auth-context'

// HD download (US-23.1): 401 without a session (the visitor signs in first, US-23.2), 404 for a capture that is not
// published, 429 past 100 downloads in an hour (US-23.3); otherwise a URL of the original, signed for 5 minutes.
export default defineEventHandler(async (event): Promise<DownloadResponse> => {
  const { container, actor } = await requireContext(event)
  const { id } = await getValidatedRouterParams(event, PhotoParams.parse)
  const { url, expiresAt } = orThrow(await container.media.requestDownload({ actor, photoId: id }))
  return { url, expiresAt: expiresAt.toISOString() }
})
