import { describe, expect, it } from 'vitest'
import { foundAcs, requiredAcs } from './test-trace.mjs'

const stories = `
### US-01 [MVP] Inscription
- US-01.1 Given a
- US-01.2 Given b
- US-01.3 Given c
### US-06 [v1.x] Export
- US-06.1 Given d
### US-74 [MVP] Pages légales
- US-74.1 Given e
- US-74.2 [v1.x, T-70] Given f
`

const plan = (t11: ' ' | 'x', t11c: ' ' | 'x', t70: ' ' | 'x' = ' ') => `
- [x] **T-01a Squelette**
  Tests : lint.
- [${t11}] **T-11b Inscription : API** (dép. T-11a)
  Stories : US-01.1–2. Tests : U, I.
- [${t11c}] **T-11c Inscription : écrans** (dép. T-11b)
  Stories : US-01 (parcours). Tests : E.
- [x] **T-10b Pages légales**
  Stories : US-74.1. Tests : E.
- [${t70}] **T-70 Versions des Terms** (dép. T-58) — US-74.2–3. Tests : U.
- [x] **T-65 Export** (dép. T-58) — US-06. Tests : U, I.
`

describe('test:trace', () => {
  it('requires nothing from unchecked tasks', () => {
    expect([...requiredAcs(plan(' ', ' '), stories)]).toEqual(['US-74.1'])
  })

  it('requires the criteria listed by a checked task', () => {
    expect([...requiredAcs(plan('x', ' '), stories)].sort()).toEqual(['US-01.1', 'US-01.2', 'US-74.1'])
  })

  it('requires a whole story once every task citing it is checked', () => {
    expect([...requiredAcs(plan('x', 'x'), stories)].sort()).toEqual(['US-01.1', 'US-01.2', 'US-01.3', 'US-74.1'])
  })

  it('ignores v1.x stories and requires a [v1.x, T-xx] criterion only once T-xx is checked', () => {
    expect(requiredAcs(plan(' ', ' '), stories).has('US-06.1')).toBe(false)
    expect(requiredAcs(plan(' ', ' '), stories).has('US-74.2')).toBe(false)
    expect(requiredAcs(plan(' ', ' ', 'x'), stories).has('US-74.2')).toBe(true)
  })

  it('does not let a task citing only v1.x criteria delay a whole MVP story', () => {
    const us70 = '### US-70 [MVP] Aucun bloc vide\n- US-70.1 Given a\n- US-70.3 [v1.x, T-63] Given b\n'
    const twoTasks =
      '- [x] **T-44 États vides**\n  Stories : US-70. Tests : E.\n- [ ] **T-63 Classement** — US-22, US-70.3.\n'
    expect([...requiredAcs(twoTasks, us70)]).toEqual(['US-70.1'])
  })

  it('stops reading a task at the next section heading', () => {
    const planWithSection =
      '- [x] **T-11b Inscription**\n  Stories : US-01.1.\n## Phase 2\nUS-01.2 cité hors tâche\n- [ ] **T-11c Écrans**\n  Stories : US-01.3.\n'
    expect([...requiredAcs(planWithSection, stories)]).toEqual(['US-01.1'])
  })

  it('finds criteria in test names and Playwright tags', () => {
    const found = foundAcs([
      `it('US-01.1 creates the account', () => {})`,
      `test('signs up', { tag: '@US-01.2' }, () => {})`,
    ])
    expect([...found].sort()).toEqual(['US-01.1', 'US-01.2'])
  })
})
