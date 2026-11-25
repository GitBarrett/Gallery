// Marks the document once the app is hydrated (`<html data-hydrated>`): the E2E wait for it before typing or
// clicking, a click before hydration being lost or sent as a plain form (CI analysis, 25/11/2026). No other use.
export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    document.documentElement.dataset.hydrated = ''
  })
})
