/** A capture that may be liked: its author, and whether it is public (published, rule of the grids). */
export interface LikeTarget {
  authorId: string
  public: boolean
}

/** A comment as its rules need it: its author, its capture and the capture's author (US-31.3, US-31.4). */
export interface StoredComment {
  id: string
  photoId: string
  userId: string
  photoAuthorId: string
  createdAt: Date
}

/** A comment of a list (US-31.1): its text as written, its author as shown. */
export interface CommentRow {
  id: string
  body: string
  userId: string
  username: string
  avatarKey: string | null
  createdAt: Date
  editedAt: Date | null
}

/** Port: the comments of the social module and the counter of the captures they change. */
export interface CommentsRepository {
  target(photoId: string): Promise<LikeTarget | null>
  /** When the account was created (Turnstile for the first day, US-31.5); null for an unknown one. */
  accountCreatedAt(userId: string): Promise<Date | null>
  /** Adds the comment and one to the counter of its capture; its id and date. */
  add(comment: { photoId: string; userId: string; body: string }): Promise<{ id: string; createdAt: Date }>
  find(id: string): Promise<StoredComment | null>
  edit(id: string, body: string, at: Date): Promise<void>
  /** Deletes the comment for good and takes one from the counter; false if it was gone. */
  remove(id: string): Promise<boolean>
  /**
   * The visible comments of a capture whose author is neither banned nor leaving, newest first, after the keyset
   * `after` when given, `limit` at most.
   */
  list(photoId: string, after: { createdAt: Date; id: string } | undefined, limit: number): Promise<CommentRow[]>
}

/** Port: the likes of the social module and the counter of the captures they change. */
export interface LikesRepository {
  target(photoId: string): Promise<LikeTarget | null>
  /** Adds the like once (US-30.3); `changed` false when it was there already; `likes`: the counter after. */
  add(userId: string, photoId: string): Promise<{ changed: boolean; likes: number }>
  /** Removes the like if there; `likes`: the counter after. */
  remove(userId: string, photoId: string): Promise<{ changed: boolean; likes: number }>
  /** Whether the member likes the capture, and its counter (the photo page is cached for everyone). */
  state(userId: string, photoId: string): Promise<{ liked: boolean; likes: number }>
  /** Records that the author was told of `tier` (0–4); false when they already were of it or a higher one. */
  raiseNotifiedTier(photoId: string, tier: number): Promise<boolean>
}
