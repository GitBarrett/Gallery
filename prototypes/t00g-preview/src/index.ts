// Prototype jetable T-00g : Worker de preview minimal qui touche chaque ressource propre à la PR
// (branche Neon via Hyperdrive, préfixe R2, Queue) pour prouver qu'elles sont branchées et isolées.
import postgres from 'postgres'

interface Env {
  HYPERDRIVE: Hyperdrive
  R2: R2Bucket
  QUEUE: Queue
  R2_PREFIX: string
  PROTO_TOKEN: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.PROTO_TOKEN || request.headers.get('authorization') !== `Bearer ${env.PROTO_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 })
    }
    const path = new URL(request.url).pathname

    if (path === '/health') {
      const sql = postgres(env.HYPERDRIVE.connectionString, { max: 1, fetch_types: false })
      try {
        await sql`create table if not exists t00g_marker (pr text)`
        await sql`insert into t00g_marker values (${env.R2_PREFIX})`
        const rows = await sql`select distinct pr from t00g_marker`
        await env.R2.put(`${env.R2_PREFIX}health`, 'ok')
        return Response.json({ dbMarkers: rows.map((r) => r.pr), r2: (await env.R2.get(`${env.R2_PREFIX}health`)) !== null })
      } finally {
        await sql.end()
      }
    }
    if (path === '/queue') {
      const id = crypto.randomUUID()
      await env.QUEUE.send({ id })
      return Response.json({ sent: id })
    }
    if (path === '/queue-done') {
      const list = await env.R2.list({ prefix: `${env.R2_PREFIX}queue/` })
      return Response.json(list.objects.map((o) => o.key))
    }
    if (path === '/cleanup') {
      let deleted = 0
      let cursor: string | undefined
      do {
        const list = await env.R2.list({ prefix: env.R2_PREFIX, cursor })
        if (list.objects.length) await env.R2.delete(list.objects.map((o) => o.key))
        deleted += list.objects.length
        cursor = list.truncated ? list.cursor : undefined
      } while (cursor)
      return Response.json({ deleted })
    }
    return new Response('Not found', { status: 404 })
  },

  async queue(batch: MessageBatch<{ id: string }>, env: Env) {
    for (const msg of batch.messages) {
      await env.R2.put(`${env.R2_PREFIX}queue/${msg.body.id}`, 'done')
      msg.ack()
    }
  },
}
