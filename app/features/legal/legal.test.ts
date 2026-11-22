import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import { LEGAL_PAGES, legalDocument, parseInline, parseMarkdown } from './legal'
import LegalDocument from './LegalDocument.vue'

describe('parseMarkdown', () => {
  it('reads headings, one paragraph per line, lists and tables, and drops editor comments', () => {
    const markdown = [
      '# Title',
      '_Last updated: 1 May_',
      '',
      '## Part <!-- note -->',
      'First.',
      'Second.',
      '- one',
      '- **two**',
      '<!-- hidden',
      'still hidden -->',
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
    ].join('\n')
    expect(parseMarkdown(markdown)).toEqual([
      { kind: 'h1', content: [{ text: 'Title' }] },
      { kind: 'p', content: [{ text: 'Last updated: 1 May', em: true }] },
      { kind: 'h2', content: [{ text: 'Part' }] },
      { kind: 'p', content: [{ text: 'First.' }] },
      { kind: 'p', content: [{ text: 'Second.' }] },
      { kind: 'ul', items: [[{ text: 'one' }], [{ text: 'two', strong: true }]] },
      { kind: 'table', head: [[{ text: 'A' }], [{ text: 'B' }]], rows: [[[{ text: '1' }], [{ text: '2' }]]] },
    ])
  })

  it('keeps underscores inside words and unmatched markers as text', () => {
    expect(parseInline('a snake_case_name, **bold** and 2 * 3')).toEqual([
      { text: 'a snake_case_name, ' },
      { text: 'bold', strong: true },
      { text: ' and 2 * 3' },
    ])
  })
})

describe('legalDocument', () => {
  it('US-74.1 every page exists in English and French, titled, with its update date first', () => {
    for (const page of LEGAL_PAGES)
      for (const locale of ['en', 'fr']) {
        const doc = legalDocument(page, locale)
        expect(doc.lang, `${page} ${locale}`).toBe(locale)
        expect(doc.title).not.toBe('')
        expect(doc.blocks[1]).toMatchObject({ kind: 'p', content: [{ em: true }] })
        expect(doc.blocks[1]!.kind === 'p' && doc.blocks[1]!.content[0]!.text).toMatch(/^(Last updated|Dernière)/)
      }
  })

  it('US-74.1 falls back to English when the page is not translated', () => {
    expect(legalDocument('terms', 'de')).toMatchObject({ lang: 'en', title: 'Terms of use' })
  })

  it('shows no editor note or panel specification', () => {
    const text = JSON.stringify([legalDocument('legal-notice', 'en'), legalDocument('cookies', 'en')])
    expect(text).not.toContain('French law allows')
    expect(text).not.toContain('UI copy')
  })
})

describe('LegalDocument', () => {
  it('US-74.1 renders the page as text, its tables in a focusable scroll region, without accessibility violation', async () => {
    const wrapper = await mountSuspended(LegalDocument, { props: { page: 'privacy' } })
    expect(wrapper.get('h1').text()).toBe('Privacy policy')
    expect(wrapper.text()).not.toMatch(/\*\*|<!--/)
    expect(wrapper.get('[role="region"]').attributes('tabindex')).toBe('0')
    expect(wrapper.findAll('th[scope="col"]')).toHaveLength(4)
    expect(await axeViolations(wrapper.element)).toEqual([])
  })
})
