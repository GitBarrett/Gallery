// Prototype jetable T-00a / T-00b / T-00c (docs/06-plan-de-taches.md). Jamais fusionné dans l'application.
// PUT  /upload/{name}        -> range le fichier dans R2 (≤ 20 Mo)
// POST /process?keys=a,b,c   -> IMAGES.info() + 6 variantes par fichier, en parallèle, avec mesures

interface Env {
  R2: R2Bucket
  IMAGES: ImagesBinding
  PROTO_TOKEN: string
}

const MAX_BYTES = 20 * 1024 * 1024

const VARIANTS = [
  { name: '64.png', width: 64, format: 'image/png' },
  { name: '1200.jpg', width: 1200, format: 'image/jpeg', quality: 85 },
  { name: '400.webp', width: 400, format: 'image/webp', quality: 82 },
  { name: '800.webp', width: 800, format: 'image/webp', quality: 82 },
  { name: '1200.webp', width: 1200, format: 'image/webp', quality: 82 },
  { name: '2400.webp', width: 2400, format: 'image/webp', quality: 82 },
] as const

async function processOne(env: Env, key: string) {
  const t0 = Date.now()
  const info = await env.IMAGES.info((await env.R2.get(`incoming/${key}`))!.body)
  const tInfo = Date.now() - t0
  const variants = []
  // Une variante à la fois : une seule en mémoire (03-architecture § Pipeline image)
  for (const v of VARIANTS) {
    const t = Date.now()
    const src = await env.R2.get(`incoming/${key}`)
    const out = await env.IMAGES.input(src!.body)
      .transform({ width: v.width, fit: 'scale-down' })
      .output({ format: v.format, ...('quality' in v ? { quality: v.quality } : {}) })
    const bytes = await (await out.response()).arrayBuffer()
    await env.R2.put(`variants/${key}/${v.name}`, bytes)
    variants.push({ name: v.name, bytes: bytes.byteLength, ms: Date.now() - t })
  }
  return { key, info, infoMs: tInfo, variants, totalMs: Date.now() - t0 }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.headers.get('authorization') !== `Bearer ${env.PROTO_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 })
    }
    const url = new URL(request.url)

    if (request.method === 'PUT' && url.pathname.startsWith('/upload/')) {
      const name = url.pathname.slice('/upload/'.length)
      const size = Number(request.headers.get('content-length'))
      if (!/^[\w.-]{1,80}$/.test(name)) return new Response('Bad name', { status: 400 })
      if (!size || size > MAX_BYTES) return new Response('Missing length or > 20 MB', { status: 413 })
      await env.R2.put(`incoming/${name}`, request.body)
      return Response.json({ stored: name, bytes: size })
    }

    if (request.method === 'POST' && url.pathname === '/process') {
      const keys = (url.searchParams.get('keys') ?? '').split(',').filter(Boolean)
      const t0 = Date.now()
      const results = await Promise.allSettled(keys.map((k) => processOne(env, k)))
      return Response.json({
        wallMs: Date.now() - t0,
        results: results.map((r, i) =>
          r.status === 'fulfilled' ? r.value : { key: keys[i], error: String(r.reason) },
        ),
      })
    }

    return new Response('Not found', { status: 404 })
  },
}
