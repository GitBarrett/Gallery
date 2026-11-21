import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { axeViolations } from '../../../tests/axe'
import QuestMarker from './QuestMarker.vue'

describe('UiQuestMarker', () => {
  it('is an image named by its label', async () => {
    const wrapper = await mountSuspended(QuestMarker, { props: { kind: 'exclamation', label: 'New contest' } })
    expect(wrapper.get('svg').attributes()).toMatchObject({ role: 'img', 'aria-label': 'New contest' })
  })

  it('draws a different glyph for "!" and "?"', async () => {
    const news = await mountSuspended(QuestMarker, { props: { kind: 'exclamation', label: 'News' } })
    const todo = await mountSuspended(QuestMarker, { props: { kind: 'question', label: 'To do' } })
    expect(news.find('.glyph').html()).not.toBe(todo.find('.glyph').html())
  })

  it('turns white when read or done, with its own gradient id', async () => {
    const wrapper = await mountSuspended(QuestMarker, { props: { kind: 'question', label: 'Done', done: true } })
    expect(wrapper.get('svg').classes()).toContain('done')
    const id = wrapper.get('linearGradient').attributes('id')
    expect(wrapper.get('.glyph path').attributes('stroke')).toBe(`url(#${id})`)
  })

  it('has no serious accessibility violation', async () => {
    const wrapper = await mountSuspended(QuestMarker, { props: { kind: 'question', label: 'Action to do' } })
    expect(await axeViolations(wrapper.element)).toEqual([])
  })
})
