// Preview only (excluded from other builds, nuxt.config.ts): unexpected error on a page, to check the 500 page (T-07c)
export default defineEventHandler(() => {
  throw new Error('T-07c: test error for the 500 page')
})
