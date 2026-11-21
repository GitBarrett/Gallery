<script setup lang="ts">
// Modal dialog (BugReport mockup); `bottom` and `full` placements make the mobile bottom sheet (BottomSheet).
// Native <dialog> + showModal(): top layer and inert page. Focus is also cycled here so Tab never leaves the
// dialog, Escape and the backdrop close it through the model, and focus returns to the opener (US-75.2).
import ActionIcon from './ActionIcon.vue'

withDefaults(defineProps<{ title: string; closeLabel: string; placement?: 'center' | 'bottom' | 'full' }>(), {
  placement: 'center',
})
const open = defineModel<boolean>('open', { default: false })
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleId = useId()
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
let opener: HTMLElement | null = null

function sync() {
  const element = dialog.value
  if (!element) return
  if (open.value && !element.open) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    element.showModal()
    ;(element.querySelector<HTMLElement>('[autofocus]') ?? element.querySelector<HTMLElement>(FOCUSABLE))?.focus()
  } else if (!open.value && element.open) {
    element.close()
    opener?.focus()
    opener = null
  }
}
onMounted(sync)
watch(open, sync, { flush: 'post' })

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    open.value = false
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return
  const items = [...dialog.value.querySelectorAll<HTMLElement>(FOCUSABLE)]
  const edge = event.shiftKey ? items[0] : items.at(-1)
  if (edge && document.activeElement === edge) {
    event.preventDefault()
    ;(event.shiftKey ? items.at(-1) : items[0])?.focus()
  }
}
</script>

<template>
  <dialog
    ref="dialog"
    class="modal"
    :class="placement"
    :aria-labelledby="titleId"
    @keydown="onKeydown"
    @cancel.prevent="open = false"
    @click.self="open = false"
  >
    <div class="panel">
      <header class="header">
        <h2 :id="titleId" class="title">{{ title }}</h2>
        <ActionIcon :label="closeLabel" @click="open = false">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </ActionIcon>
      </header>
      <div class="body"><slot /></div>
      <footer v-if="$slots.actions" class="actions"><slot name="actions" /></footer>
    </div>
  </dialog>
</template>

<style scoped>
.modal {
  width: calc(100% - 2 * var(--space-4));
  max-width: var(--dialog-width);
  max-height: calc(100dvh - 2 * var(--space-4));
  padding: 0;
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-raised);
  animation: appear var(--duration-normal) var(--ease-out);
}

.modal::backdrop {
  background: var(--color-backdrop);
}

.bottom,
.full {
  width: 100%;
  max-width: 100%;
  margin: auto 0 0;
  border-width: var(--border-width) 0 0;
  animation-name: rise;
}

.bottom {
  max-height: 85dvh;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.full {
  height: 100dvh;
  max-height: 100dvh;
  border-radius: 0;
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom));
}

.header {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: flex-end;
}

@keyframes appear {
  from {
    opacity: 0;
    transform: scale(0.97);
  }
}

@keyframes rise {
  from {
    transform: translateY(100%);
  }
}
</style>
