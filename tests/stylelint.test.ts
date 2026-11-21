import stylelint from 'stylelint'
import { describe, expect, it } from 'vitest'
import config from '../stylelint.config.mjs'

// ADR-014 : hors de tokens.css, une valeur en dur est refusée ; un composant n'emploie que var(--…).
const lint = async (code: string, codeFilename = 'app/components/ui/Example.vue') =>
  (await stylelint.lint({ code, codeFilename, config })).results[0]!.warnings.map((w) => w.rule)

// Une déclaration par ligne, comme dans un vrai composant
const vue = (css: string) =>
  `<template><p class="x">x</p></template>\n<style scoped>\n.x {\n  ${css.split('; ').join(';\n  ')}\n}\n</style>\n`

describe('Stylelint: values only from the design tokens', () => {
  it.each([
    ['a hard-coded colour', 'color: #e8b54a;'],
    ['a colour hidden in a shorthand', 'border: 1px solid #2a3244;'],
    ['a hard-coded font size', 'font-size: 13px;'],
    ['a hard-coded spacing', 'padding: 12px;'],
    ['a hard-coded z-index', 'z-index: 999;'],
  ])('refuses %s in a component', async (_, css) => {
    expect(await lint(vue(css))).toContain('scale-unlimited/declaration-strict-value')
  })

  it('accepts tokens', async () => {
    expect(
      await lint(
        vue(
          'color: var(--color-text); padding: var(--space-3) var(--space-4); border: var(--border-width) solid var(--color-border);',
        ),
      ),
    ).toEqual([])
  })
})
