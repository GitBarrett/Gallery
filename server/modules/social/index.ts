// social module (03-architecture.md § Modules): likes now, then comments, follows and collections. Depends on identity
// through its index.ts only.
export type { CommentRow, CommentsRepository, LikesRepository, LikeTarget, StoredComment } from './application/ports'
export {
  COMMENTS_PER_10_MIN,
  deleteComment,
  editComment,
  listComments,
  postComment,
  type CommentView,
} from './application/comments'
export { drizzleCommentsRepository } from './infrastructure/drizzle-comments-repository'
export { LIKES_PER_HOUR, likePhoto, unlikePhoto, viewLike, type SocialError } from './application/likes'
export { drizzleLikesRepository } from './infrastructure/drizzle-likes-repository'
export { orThrow } from './interface/social-http'
