import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Contrastes AA de la palette (US-75, 07-design.md) calculés sur tokens.css : un changement de couleur qui casse la
// lisibilité échoue ici, avant toute revue visuelle.
const css = readFileSync(new URL('../app/assets/css/tokens.css', import.meta.url), 'utf8')
const token = (name: string) => {
  const hex = new RegExp(`--${name}:\\s*(#[0-9a-f]{3,6})`, 'i').exec(css)?.[1]
  if (!hex) throw new Error(`token --${name} absent ou non hexadécimal`)
  return hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex
}
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(token(a)), luminance(token(b))].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

describe('design tokens: AA contrast (4.5:1)', () => {
  const backgrounds = ['color-bg', 'color-surface', 'color-surface-raised', 'color-surface-hover']
  const texts = ['color-text', 'color-text-soft', 'color-text-muted', 'color-text-faint', 'color-accent']

  it.each(backgrounds.flatMap((bg) => texts.map((text) => [text, bg])))('%s on %s', (text, bg) => {
    expect(contrast(text!, bg!)).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['color-on-accent', 'color-accent'],
    ['color-danger', 'color-surface-raised'],
    ['color-success', 'color-surface-raised'],
    ['color-arcane', 'color-bg'],
  ])('%s on %s', (text, bg) => {
    expect(contrast(text!, bg!)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['quality-poor', 'quality-uncommon', 'quality-rare', 'quality-epic', 'quality-legendary'])(
    '%s stays readable as a title on cards',
    (quality) => {
      expect(contrast(quality, 'color-surface')).toBeGreaterThanOrEqual(4.5)
    },
  )
})
