/** A capture that may be liked: its author, and whether it is public (published, rule of the grids). */
export interface LikeTarget {
  authorId: string
  public: boolean
}

/** Port: the likes of the social module and the counter of the captures they change. */
export interface LikesRepository {
  target(photoId: string): Promise<LikeTarget | null>
  /** Adds the like once (US-30.3); `changed` false when it was there already; `likes`: the counter after. */
  add(userId: string, photoId: string): Promise<{ changed: boolean; likes: number }>
  /** Removes the like if there; `likes`: the counter after. */
  remove(userId: string, photoId: string): Promise<{ changed: boolean; likes: number }>
  /** Records that the author was told of `tier` (0–4); false when they already were of it or a higher one. */
  raiseNotifiedTier(photoId: string, tier: number): Promise<boolean>
}
