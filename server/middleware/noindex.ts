// Les previews ne doivent jamais être indexées (ADR-013)
export default defineEventHandler((event) => {
  if (event.context.container.config.deployEnv === 'preview')
    setResponseHeader(event, 'x-robots-tag', 'noindex, nofollow')
})
