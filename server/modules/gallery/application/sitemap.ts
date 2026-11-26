import { isSitemapName, sitemapFiles, type SitemapEntry } from '../domain/sitemap'

/**
 * Port: what the sitemap lists (US-25.2, US-25.3), as the pages show them: the versions not archived, the profiles
 * of accounts neither banned nor being deleted with a public capture, and the public captures (the rule of the grids).
 */
export interface GallerySitemap {
  sitemapEntries(): Promise<SitemapEntry[]>
}

/** Port: where the daily cron keeps the files of the sitemap (the private bucket). */
export interface SitemapStore {
  put(name: string, xml: string): Promise<void>
  read(name: string): Promise<string | null>
}

type Deps = { repo: GallerySitemap; store: SitemapStore; siteUrl: string }

const build = async (deps: Deps) => sitemapFiles([{ path: '/' }, ...(await deps.repo.sitemapEntries())], deps.siteUrl)

/** Daily cron (03 § Cron): the sitemap rebuilt and stored; the number of files. */
export const publishSitemap = (deps: Deps) => async (): Promise<number> => {
  const files = await build(deps)
  for (const [name, xml] of files) await deps.store.put(name, xml)
  return files.size
}

/**
 * A file of the sitemap (public read): the one the cron stored, otherwise built on the spot (before the first run,
 * a fresh preview); null for any other name.
 */
export const readSitemap =
  (deps: Deps) =>
  async (name: string): Promise<string | null> => {
    if (!isSitemapName(name)) return null
    return (await deps.store.read(name)) ?? (await build(deps)).get(name) ?? null
  }
