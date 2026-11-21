import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// US-62.3: a key missing in en.json or fr.json fails the build (pnpm check runs this test in CI).
type Messages = { [key: string]: string | Messages }
const read = (locale: string): Messages => JSON.parse(readFileSync(`i18n/${locale}.json`, 'utf8'))
const keys = (messages: Messages, prefix = ''): string[] =>
  Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'string' ? (value.trim() ? [prefix + key] : []) : keys(value, `${prefix}${key}.`),
  )

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : /\.(vue|ts)$/.test(entry.name) && !/\.(test|stories)\.ts$/.test(entry.name)
        ? [join(dir, entry.name)]
        : [],
  )
// Literal keys only (t('a.b'), $t('a.b')); a computed key is covered by the en/fr comparison
const usedKeys = () =>
  files('app').flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/\$?\bt\(\s*'([\w.-]+)'/g)].map((m) => m[1]!))

describe('i18n', () => {
  const en = keys(read('en'))
  const fr = keys(read('fr'))

  it('US-62.3 en.json and fr.json have the same non-empty keys', () => {
    expect(fr.filter((key) => !en.includes(key))).toEqual([])
    expect(en.filter((key) => !fr.includes(key))).toEqual([])
  })

  it('US-62.3 every key used in the interface exists in both languages', () => {
    const used = usedKeys()
    expect(used.length).toBeGreaterThan(0)
    expect(used.filter((key) => !en.includes(key) || !fr.includes(key))).toEqual([])
  })
})
