// Sorts of the grids (US-20.3): most recent, most liked, most downloaded first.
export const GRID_SORTS = ['recent', 'popular', 'downloads'] as const
export type GridSort = (typeof GRID_SORTS)[number]
