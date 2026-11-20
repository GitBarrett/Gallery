import { systemClock, type Clock } from './clock'
import type { Config } from './config'
import { uuidV7Generator, type IdGenerator } from './ids'
import { createLogger, type Logger } from './logger'

/** Composition root : construit, par requête, les dépendances des use cases (10-clean-architecture.md § 5). */
export interface Container {
  config: Config
  clock: Clock
  ids: IdGenerator
  logger: Logger
}

export function createContainer({ config, correlationId }: { config: Config; correlationId: string }): Container {
  return { config, clock: systemClock, ids: uuidV7Generator(systemClock), logger: createLogger({ correlationId }) }
}
