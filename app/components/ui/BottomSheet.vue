<script setup lang="ts">
// Mobile bottom sheet (07-design.md § Responsive, US-67.3–4): the Modal anchored at the bottom, or full screen for
// the filters. Same focus trap, Escape and focus return (US-75.2).
import Modal from './Modal.vue'

defineProps<{ title: string; closeLabel: string; full?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <Modal v-model:open="open" :title="title" :close-label="closeLabel" :placement="full ? 'full' : 'bottom'">
    <slot />
    <template v-if="$slots.actions" #actions><slot name="actions" /></template>
  </Modal>
</template>
