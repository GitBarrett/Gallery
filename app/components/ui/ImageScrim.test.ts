import { readFileSync } from 'node:fs'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { axeViolations } from '../../../tests/axe'
import ImageScrim from './ImageScrim.vue'

// happy-dom renders no image pixels: the contrast is computed on the tokens, the veil laid over the worst photos,
// a pure white and a pure black area (07-design.md § Texte sur image). Playwright checks real pages later.
const css = readFileSync('app/assets/css/tokens.css', 'utf8') // from the repository root: import.meta.url is not file: here
const rgb = (name: string): number[] => {
  const value = css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim()
  if (!value) throw new Error(`token --${name} missing`)
  const veil = value.match(/^rgb\((\d+) (\d+) (\d+) \/ (\d+)%\)$/)
  if (veil) return veil.slice(1, 5).map(Number)
  const hex = value.length === 4 ? [...value.slice(1)].map((c) => c + c).join('') : value.slice(1)
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(100)
}
const over = ([r, g, b, a]: number[], background: number[]) =>
  [r!, g!, b!].map((c, i) => (c * a!) / 100 + background[i]! * (1 - a! / 100))
const luminance = (color: number[]) => {
  const [r, g, b] = color.map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}
const white = [255, 255, 255]
const black = [0, 0, 0]

describe('UiImageScrim', () => {
  it.each([
    ['color-veil', 'white', white],
    ['color-veil', 'black', black],
    ['color-veil-max', 'white', white],
    ['color-veil-max', 'black', black],
  ])('keeps text readable (AA 4.5:1) on %s over a %s photo', (veil, _name, photo) => {
    const background = over(rgb(veil as string), photo as number[])
    for (const text of ['color-text', 'color-text-soft', 'color-white']) {
      expect(contrast(rgb(text).slice(0, 3), background)).toBeGreaterThanOrEqual(4.5)
    }
  })

  const slots = { default: () => h('img', { src: '/capture.webp', alt: 'Suramar' }), caption: () => 'Arcane Dusk' }

  it('lays the caption on a veil over the image, at the max level when asked', async () => {
    const wrapper = await mountSuspended(ImageScrim, { slots })
    expect(wrapper.find('img').exists()).toBe(true)
    expect(wrapper.get('.veil').text()).toBe('Arcane Dusk')
    expect(wrapper.get('.veil').classes()).not.toContain('max')
    await wrapper.setProps({ level: 'max' })
    expect(wrapper.get('.veil').classes()).toContain('max')
  })

  it('has no serious accessibility violation', async () => {
    const wrapper = await mountSuspended(ImageScrim, { slots })
    expect(await axeViolations(wrapper.element)).toEqual([])
  })
})
