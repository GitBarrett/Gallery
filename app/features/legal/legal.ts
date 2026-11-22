// Legal pages (US-74.1): the repository Markdown of docs/legal (English) and docs/legal/fr, turned into blocks that
// the template renders as text (no v-html). Only the subset the drafts use: `#`/`##` headings, one paragraph per
// line, `- ` lists, tables, **bold** and _italic_. HTML comments are notes for editors and are dropped.
export type Inline = { text: string; strong?: true; em?: true }
export type Block =
  | { kind: 'h1' | 'h2' | 'p'; content: Inline[] }
  | { kind: 'ul'; items: Inline[][] }
  | { kind: 'table'; head: Inline[][]; rows: Inline[][][] }

export const LEGAL_PAGES = ['legal-notice', 'terms', 'privacy', 'cookies'] as const
export type LegalPage = (typeof LEGAL_PAGES)[number]

// Bundled with the legal pages only (about 25 kB of text, both languages)
const sources = import.meta.glob<string>(['../../../docs/legal/*.md', '../../../docs/legal/fr/*.md'], {
  query: '?raw',
  import: 'default',
  eager: true,
})

export function parseInline(text: string): Inline[] {
  return text
    .split(/(\*\*[^*]+\*\*|(?<!\w)_[^_]+_(?!\w))/)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**')) return { text: part.slice(2, -2), strong: true }
      if (/^_.+_$/.test(part)) return { text: part.slice(1, -1), em: true }
      return { text: part }
    })
}

const cells = (line: string) =>
  line
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => parseInline(cell.trim()))

export function parseMarkdown(markdown: string): Block[] {
  const blocks: Block[] = []
  for (const raw of markdown.replace(/<!--[\s\S]*?-->/g, '').split('\n')) {
    const line = raw.trim()
    const last = blocks.at(-1)
    if (!line || /^\|[\s|:-]+\|$/.test(line)) continue
    else if (line.startsWith('## ')) blocks.push({ kind: 'h2', content: parseInline(line.slice(3)) })
    else if (line.startsWith('# ')) blocks.push({ kind: 'h1', content: parseInline(line.slice(2)) })
    else if (line.startsWith('- ')) {
      if (last?.kind === 'ul') last.items.push(parseInline(line.slice(2)))
      else blocks.push({ kind: 'ul', items: [parseInline(line.slice(2))] })
    } else if (line.startsWith('|')) {
      if (last?.kind === 'table') last.rows.push(cells(line))
      else blocks.push({ kind: 'table', head: cells(line), rows: [] })
    } else blocks.push({ kind: 'p', content: parseInline(line) })
  }
  return blocks
}

/** The page in the reader's language, or in English when it is not translated yet (`lang` then says so). */
export function legalDocument(page: LegalPage, locale: string) {
  const translated = sources[`../../../docs/legal/${locale}/${page}.md`]
  const lang = translated ? locale : 'en'
  const blocks = parseMarkdown(translated ?? sources[`../../../docs/legal/${page}.md`]!)
  const title = blocks.flatMap((block) => (block.kind === 'h1' ? block.content.map((part) => part.text) : [])).join('')
  return { lang, title, blocks }
}
