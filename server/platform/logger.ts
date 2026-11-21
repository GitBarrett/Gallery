/** Structured JSON logs, without personal data or secrets (03-architecture.md § Observabilité). */
export interface Logger {
  info(msg: string, fields?: Record<string, unknown>): void
  warn(msg: string, fields?: Record<string, unknown>): void
  error(msg: string, fields?: Record<string, unknown>): void
}

const SENSITIVE = /^(email|password.*|.*token|.*secret|authorization|cookie|ip(address)?)$/i

function clean(fields: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => {
      if (SENSITIVE.test(key)) return [key, '[redacted]']
      if (value instanceof Error) return [key, { name: value.name, message: value.message }]
      return [key, value]
    }),
  )
}

export function createLogger(
  base: { correlationId: string; module?: string },
  write: (line: string) => void = (line) => console.log(line),
): Logger {
  const log =
    (level: string) =>
    (msg: string, fields: Record<string, unknown> = {}) =>
      write(JSON.stringify({ level, msg, ...base, ...clean(fields) }))
  return { info: log('info'), warn: log('warn'), error: log('error') }
}
