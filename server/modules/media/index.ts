// media module (03-architecture.md § Modules): upload, private storage, processing (T-22b), serving (T-25a).
export type { MediaRepository, ObjectStorage, StoredObject } from './application/ports'
export {
  completeUpload,
  CONCURRENT_UPLOADS,
  purgeOrphanUploads,
  requestUploadUrl,
  UPLOAD_URL_SECONDS,
  UPLOADS_PER_DAY,
} from './application/uploads'
export { drizzleMediaRepository } from './infrastructure/drizzle-media-repository'
export { memoryBucket, r2ObjectStorage, type R2Bucket } from './infrastructure/r2-object-storage'
export { orThrow } from './interface/media-http'
