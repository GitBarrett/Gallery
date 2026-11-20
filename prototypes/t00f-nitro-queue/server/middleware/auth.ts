// Sans secret défini, tout est refusé (sinon « Bearer undefined » passerait)
export default defineEventHandler((event) => {
  const token = event.context.cloudflare.env.PROTO_TOKEN
  if (!token || getHeader(event, 'authorization') !== `Bearer ${token}`) {
    throw createError({ statusCode: 401 })
  }
})
