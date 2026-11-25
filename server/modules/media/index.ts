// media module (03-architecture.md § Modules): upload, private storage, processing (T-22b), serving (T-25a).
export type {
  CaptureDetails,
  DetailsChanges,
  ImageInfo,
  ImageService,
  MediaRepository,
  ObjectStorage,
  Processed,
  StoredObject,
  VariantFormat,
} from './application/ports'
export { originalKey, variantKey } from './application/ports'
export { failCapture, processCapture, VARIANTS } from './application/process-capture'
export {
  completeUpload,
  CONCURRENT_UPLOADS,
  purgeOrphanUploads,
  requestUploadUrl,
  UPLOAD_URL_SECONDS,
  UPLOADS_PER_DAY,
} from './application/uploads'
export { drizzleMediaRepository } from './infrastructure/drizzle-media-repository'
export { imagesBindingService, type ImagesBinding } from './infrastructure/images-binding'
export { memoryBucket, r2ObjectStorage, type R2Bucket } from './infrastructure/r2-object-storage'
export { orThrow } from './interface/media-http'
export { PROCESS_ATTEMPTS, photoProcessConsumer } from './interface/photo-process-consumer'
export type { CachePurger } from './application/ports'
export { IMAGE_SIZES, removeImages, serveImage, type ServedImage } from './application/serve-image'
export { cloudflareCachePurger } from './infrastructure/cloudflare-cache-purger'
export type { OwnCapture } from './application/ports'
export { listMyCaptures, MY_CAPTURES_PAGE } from './application/my-captures'
export { deleteCapture, editCapture } from './application/edit-capture'
