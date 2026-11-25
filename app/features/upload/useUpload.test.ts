import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readBody } from 'h3'
import { useUpload } from './useUpload'

const id = (n: number) => `0193a000-0000-7000-8000-00000000000${n}`
let asked = 0
const completed: unknown[] = []
registerEndpoint('/api/photos/upload-url', {
  method: 'POST',
  handler: () => ({
    photoId: id(++asked),
    url: `https://r2.test/incoming/${asked}`,
    expiresAt: '2026-11-25T10:10:00.000Z',
  }),
})
for (const n of [1, 2])
  registerEndpoint(`/api/photos/${id(n)}/complete`, {
    method: 'POST',
    handler: async (event) => {
      completed.push({ id: id(n), body: await readBody(event) })
      return { photoId: id(n), status: 'processing' }
    },
  })

// The PUTs to the bucket: `statuses` answered in turn, each after one progress event
function fakeXhr(statuses: number[]) {
  const puts: string[] = []
  class FakeXhr {
    status = 0
    upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {}
    onload?: () => void
    onerror?: () => void
    private url = ''
    open(_method: string, url: string) {
      this.url = url
    }
    setRequestHeader() {}
    send() {
      puts.push(this.url)
      this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 })
      this.status = statuses.shift() ?? 200
      if (this.status) this.onload?.()
      else this.onerror?.()
    }
  }
  vi.stubGlobal('XMLHttpRequest', FakeXhr)
  return puts
}

const chosen = {
  file: new File([new Uint8Array(10)], 'dusk.jpg', { type: 'image/jpeg' }),
  width: 1920,
  height: 1080,
  preview: 'blob:x',
}
const details = { title: 'Dusk', gameVersion: 'wow-forever' }

afterEach(() => {
  vi.unstubAllGlobals()
  asked = 0
  completed.length = 0
})

describe('useUpload', () => {
  it('US-10.1 puts the file through the presigned URL, then completes it; the update toast waits meanwhile', async () => {
    const puts = fakeXhr([200])
    const { send, progress } = useUpload()
    const inProgress = useUploadInProgress()
    const sending = send(chosen, details)
    expect(inProgress.value).toBe(true) // US-65.2
    expect(await sending).toBe(id(1))
    expect(puts).toEqual(['https://r2.test/incoming/1'])
    expect(completed).toEqual([{ id: id(1), body: details }])
    expect([progress.value, inProgress.value]).toEqual([1, false])
  })

  it('US-10.6 asks a new URL once when the PUT is refused (expired URL), then gives up', async () => {
    const puts = fakeXhr([0, 200])
    expect(await useUpload().send(chosen, details)).toBe(id(2))
    expect(puts).toEqual(['https://r2.test/incoming/1', 'https://r2.test/incoming/2'])
    expect(completed).toEqual([{ id: id(2), body: details }])

    asked = 0
    completed.length = 0
    fakeXhr([403, 0])
    await expect(useUpload().send(chosen, details)).rejects.toThrow('upload failed')
    expect(completed).toEqual([])
    expect(useUploadInProgress().value).toBe(false)
  })
})
