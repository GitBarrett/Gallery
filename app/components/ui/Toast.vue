<script setup lang="ts">
// Short message at the bottom of the screen (US-65.1 update toast). The live region stays in the page so the
// message is announced when it appears; no timer: it stays until acted on or dismissed, so it cannot be missed.
import ActionIcon from './ActionIcon.vue'
import Button from './Button.vue'

defineProps<{ message: string; dismissLabel: string; actionLabel?: string }>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="region" role="status">
    <div v-if="open" class="toast">
      <p class="message">{{ message }}</p>
      <Button v-if="actionLabel" variant="secondary" @click="emit('action')">{{ actionLabel }}</Button>
      <ActionIcon :label="dismissLabel" @click="open = false">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </ActionIcon>
    </div>
  </div>
</template>

<style scoped>
.region {
  position: fixed;
  inset: auto var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom));
  z-index: var(--z-toast);
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.toast {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  max-width: var(--dialog-width);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-raised);
  pointer-events: auto;
  animation: rise var(--duration-normal) var(--ease-out);
}

.message {
  flex: 1;
  margin: 0;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(var(--space-4));
  }
}
</style>
