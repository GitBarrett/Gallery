// GET /status -> traces laissées par les hooks
export default defineEventHandler(async (event) => {
  const list = await event.context.cloudflare.env.R2.list({ prefix: 't00f/' })
  return list.objects.map((o) => o.key)
})
