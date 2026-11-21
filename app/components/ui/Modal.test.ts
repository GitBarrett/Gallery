import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import { axeViolations } from '../../../tests/axe'
import Modal from './Modal.vue'

let opener: HTMLButtonElement
let wrapper: VueWrapper

// Mounted in the document (focus needs it), controlled by its parent like v-model:open.
async function mountModal(placement?: 'center' | 'bottom' | 'full') {
  opener = document.body.appendChild(document.createElement('button'))
  opener.focus()
  wrapper = await mountSuspended(Modal, {
    attachTo: document.body,
    props: {
      title: 'Report a bug',
      closeLabel: 'Close',
      placement,
      open: false,
      'onUpdate:open': (open: boolean) => wrapper.setProps({ open }),
    },
    slots: {
      default: () => h('input', { 'aria-label': 'Description' }),
      actions: () => h('button', 'Send'),
    },
  })
  await wrapper.setProps({ open: true })
  await nextTick()
  return wrapper.get('dialog').element as HTMLDialogElement
}

const press = (key: string, shiftKey = false) => wrapper.get('dialog').trigger('keydown', { key, shiftKey })
const focused = () => document.activeElement?.textContent || document.activeElement?.getAttribute('aria-label')

afterEach(() => {
  wrapper.unmount()
  opener.remove()
})

describe('UiModal', () => {
  it('US-75.2 opens as a modal dialog named by its title, focus inside', async () => {
    const dialog = await mountModal()
    expect(dialog.open).toBe(true)
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe('Report a bug')
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('US-75.2 traps focus: Tab from the last element goes back to the first, Shift+Tab the other way', async () => {
    await mountModal()
    expect(focused()).toBe('Close')
    ;(wrapper.get('dialog').findAll('button').at(-1)!.element as HTMLElement).focus()
    await press('Tab')
    expect(focused()).toBe('Close')
    await press('Tab', true)
    expect(focused()).toBe('Send')
  })

  it('US-75.2 closes with Escape and gives focus back to its opener', async () => {
    const dialog = await mountModal()
    await press('Escape')
    expect(wrapper.emitted('update:open')).toEqual([[false]])
    expect(dialog.open).toBe(false)
    expect(document.activeElement).toBe(opener)
  })

  it('closes with its close button and with a click on the backdrop', async () => {
    const dialog = await mountModal()
    await wrapper.get('button[aria-label="Close"]').trigger('click')
    expect(dialog.open).toBe(false)
    await wrapper.setProps({ open: true })
    await wrapper.get('dialog').trigger('click')
    expect(dialog.open).toBe(false)
  })

  it('does not close on a click inside its panel', async () => {
    const dialog = await mountModal()
    await wrapper.get('input').trigger('click')
    expect(dialog.open).toBe(true)
  })

  it('takes the bottom sheet placements', async () => {
    const dialog = await mountModal('full')
    expect(dialog.classList).toContain('full')
  })

  it('has no serious accessibility violation once open', async () => {
    const dialog = await mountModal()
    expect(await axeViolations(dialog)).toEqual([])
  })
})
