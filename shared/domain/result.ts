/** Résultat d'une opération métier : les erreurs attendues sont des valeurs, pas des exceptions (10-clean-architecture.md § 4). */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error })
