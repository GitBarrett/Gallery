import { convertedName, MIME, type Encoding, type Source } from './chain'
import type { ConvertAnswer } from './convert.worker'

export type Converted =
  { ok: true; file: File; encoding: Encoding } | { ok: false; error: 'memory' | 'too_large' | 'failed' }

/**
 * Converts a TGA or a large PNG in a Web Worker (same-origin file: `worker-src 'self'`), then stops it, which frees
 * its memory. A worker the browser kills for lack of memory (mobile) answers `memory` (US-10.10).
 */
export function convertFile(file: File, source: Source): Promise<Converted> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('./convert.worker.ts', import.meta.url), { type: 'module' })
    const done = (answer: Converted) => {
      worker.terminate()
      resolve(answer)
    }
    worker.onmessage = ({ data }: MessageEvent<ConvertAnswer>) =>
      done(
        data.ok
          ? {
              ok: true,
              encoding: data.encoding,
              file: new File([data.bytes], convertedName(file.name, data.encoding), { type: MIME[data.encoding] }),
            }
          : data,
      )
    worker.onerror = () => done({ ok: false, error: 'memory' })
    void file.arrayBuffer().then(
      (buffer) => worker.postMessage({ source, file: buffer }, [buffer]),
      () => done({ ok: false, error: 'memory' }), // the file itself does not fit in memory
    )
  })
}
