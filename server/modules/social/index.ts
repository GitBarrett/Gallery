// social module (03-architecture.md § Modules): likes now, then comments, follows and collections. Depends on identity
// through its index.ts only.
export type { LikesRepository, LikeTarget } from './application/ports'
export { LIKES_PER_HOUR, likePhoto, unlikePhoto, type SocialError } from './application/likes'
export { drizzleLikesRepository } from './infrastructure/drizzle-likes-repository'
export { orThrow } from './interface/social-http'
