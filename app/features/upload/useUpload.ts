import { validateCaptureFile, type CaptureFileProblem } from '~~/shared/domain/capture-file'
import type { CompleteUploadBody } from '~~/shared/contracts/photos'
import { api } from '~/services/api'

export interface ChosenFile {
  file: File
  width: number
  height: number
  /** Object URL of the file for the thumbnail (blob:, allowed by the CSP); revoked when another file is chosen. */
  preview: string
}

/** Dimensions read by the browser, then the rules of shared/domain (US-10.2): the server checks them again. */
export async function inspectFile(
  file: File,
): Promise<{ ok: true; value: ChosenFile } | { ok: false; error: CaptureFileProblem }> {
  const preview = URL.createObjectURL(file)
  const size = await new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => resolve({ width: 0, height: 0 }) // not an image the browser reads: refused below
    image.src = preview
  })
  const checked = validateCaptureFile({ contentType: file.type, bytes: file.size, ...size })
  if (!checked.ok) {
    URL.revokeObjectURL(preview)
    return checked
  }
  return { ok: true, value: { file, ...size, preview } }
}

/** PUT of the file through the presigned URL, with its progress (0–1); the status, 0 when the browser saw no answer. */
function put(url: string, file: File, progress: (share: number) => void): Promise<number> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest()
    request.open('PUT', url)
    request.setRequestHeader('content-type', file.type)
    request.upload.onprogress = (event) => event.lengthComputable && progress(event.loaded / event.total)
    request.onload = () => resolve(request.status)
    request.onerror = () => resolve(0) // network, or an expired URL (403 without CORS headers: unreadable)
    request.send(file)
  })
}

/**
 * Upload of a capture (03 § Pipeline image 1–3): presigned URL, PUT straight to the private bucket, then `complete`
 * with the details. A failed PUT asks a new URL once and starts again (03 § 2). The update toast waits meanwhile
 * (US-65.2). Throws the ApiError of the server (429 with its delay, 422, 400 with the field).
 */
export function useUpload() {
  const progress = ref(0)
  const inProgress = useUploadInProgress()

  async function send(chosen: ChosenFile, details: CompleteUploadBody): Promise<string> {
    inProgress.value = true
    progress.value = 0
    try {
      const declared = {
        contentType: chosen.file.type,
        bytes: chosen.file.size,
        width: chosen.width,
        height: chosen.height,
      }
      let photoId = ''
      for (let attempt = 0; attempt < 2; attempt++) {
        const asked = await api.uploadUrl(declared)
        photoId = asked.photoId
        const status = await put(asked.url, chosen.file, (share) => (progress.value = share))
        if (status >= 200 && status < 300) break
        if (attempt === 1) throw new Error('upload failed')
      }
      await api.completeUpload(photoId, details)
      progress.value = 1
      return photoId
    } finally {
      inProgress.value = false
    }
  }

  return { progress, send }
}
