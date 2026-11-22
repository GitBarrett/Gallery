import type { SiteSettings } from '../modules/settings'
import { systemClock, type Clock } from './clock'
import type { Config } from './config'
import { uuidV7Generator, type IdGenerator } from './ids'
import { createLogger, type Logger } from './logger'

/** Composition root: builds, per request, the dependencies of the use cases (10-clean-architecture.md § 5). */
export interface Container {
  config: Config
  clock: Clock
  ids: IdGenerator
  logger: Logger
  /** Site settings, cached 60 s per isolate (settings module). */
  settings: () => Promise<SiteSettings>
}

export function createContainer({
  config,
  correlationId,
  readSettings,
}: {
  config: Config
  correlationId: string
  readSettings: (logger: Logger) => Promise<SiteSettings>
}): Container {
  const logger = createLogger({ correlationId })
  return { config, clock: systemClock, ids: uuidV7Generator(systemClock), logger, settings: () => readSettings(logger) }
}
