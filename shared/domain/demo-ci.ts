// DÉMO T-04a, jamais fusionnée : chaque ligne viole une garde de la CI.
import { loadConfig } from '../../server/platform/config' // arch : shared/ n'importe pas server/
export const typeError: number = 'pas un nombre' // typecheck
export function uncovered(a: number) { if (a > 1) { return a * 2 } return loadConfig({}) }   // couverture + prettier
export const runUserCode = (code: string) => eval(code) // Semgrep : eval d'une expression
