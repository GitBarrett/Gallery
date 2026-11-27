import { CommentsQuery, type CommentsResponse } from '../../../../shared/contracts/comments'
import { PhotoParams } from '../../../../shared/contracts/photos'
import { orThrow, type CommentView } from '../../../modules/social'

const serialised = (c: CommentView) => ({
  ...c,
  createdAt: c.createdAt.toISOString(),
  editedAt: c.editedAt?.toISOString() ?? null,
})

// The comments of a public capture (US-31.1), for every visitor (annexe B); never cached: they change with each post.
export default defineEventHandler(async (event): Promise<CommentsResponse> => {
  const { id } = await getValidatedRouterParams(event, PhotoParams.parse)
  const query = await getValidatedQuery(event, CommentsQuery.parse)
  const page = orThrow(await event.context.container.social.listComments({ photoId: id, ...query }))
  setResponseHeader(event, 'cache-control', 'no-store')
  return { items: page.items.map(serialised), nextCursor: page.nextCursor }
})
