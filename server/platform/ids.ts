import type { Clock } from './clock'

/** Port de génération d'identifiants : UUID v7 pour toutes les clés (CLAUDE.md). */
export interface IdGenerator {
  next(): string
}

/** UUID v7 (RFC 9562) : 48 bits d'horodatage en ms, version 7, variante 10, 74 bits aléatoires. */
export function uuidV7(timestampMs: number, random: Uint8Array): string {
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 6; i++) bytes[i] = Math.floor(timestampMs / 2 ** (8 * (5 - i))) & 0xff
  bytes[6] = 0x70 | (random[0]! & 0x0f)
  bytes[7] = random[1]!
  bytes[8] = 0x80 | (random[2]! & 0x3f)
  bytes.set(random.subarray(3, 10), 9)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export const uuidV7Generator = (clock: Clock): IdGenerator => ({
  next: () => uuidV7(clock.now().getTime(), crypto.getRandomValues(new Uint8Array(10))),
})
