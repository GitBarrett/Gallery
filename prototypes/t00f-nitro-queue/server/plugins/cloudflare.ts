// Prototype jetable T-00f : les hooks Nitro `cloudflare:queue` et `cloudflare:scheduled` sont-ils appelés,
// et une erreur dans le hook déclenche-t-elle un nouvel essai ? Chaque passage laisse une trace dans R2.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('cloudflare:queue', async ({ batch, env }) => {
    for (const msg of batch.messages) {
      const { id, mode } = msg.body as { id: string; mode: 'ok' | 'throw' | 'retry' }
      await env.R2.put(`t00f/queue/${mode}/${id}/attempt-${msg.attempts}`, new Date().toISOString())
      if (mode === 'throw') throw new Error(`T-00f throw ${id}`)
      if (mode === 'retry') msg.retry()
      else msg.ack()
    }
  })

  nitroApp.hooks.hook('cloudflare:scheduled', async ({ controller, env }) => {
    await env.R2.put(`t00f/cron/${new Date(controller.scheduledTime).toISOString()}`, controller.cron)
  })
})
