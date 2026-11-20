// POST /send?mode=ok|throw|retry -> publie un message dans la Queue
export default defineEventHandler(async (event) => {
  const mode = getQuery(event).mode
  if (mode !== 'ok' && mode !== 'throw' && mode !== 'retry') throw createError({ statusCode: 400 })
  const id = crypto.randomUUID()
  await event.context.cloudflare.env.QUEUE.send({ id, mode })
  return { sent: id, mode }
})
