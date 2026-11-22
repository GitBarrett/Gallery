import { z } from 'zod'

// Contracts import z from here so this runs before any schema is built: Zod reads `jitless` at schema creation.
// Its JIT probes `new Function`, which the strict CSP reports as a violation in the browser.
z.config({ jitless: true })

export { z }
