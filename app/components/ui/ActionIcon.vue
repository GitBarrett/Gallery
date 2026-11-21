<script setup lang="ts">
// Icon-only action (like, share, full screen, close; Photo mockup). The icon carries no text, so the label is
// mandatory; 44 px target (US-75); `pressed` turns it into a toggle such as Like.
withDefaults(defineProps<{ label: string; pressed?: boolean; disabled?: boolean }>(), { pressed: undefined })
</script>

<template>
  <button
    type="button"
    class="action-icon"
    :aria-label="label"
    :title="label"
    :aria-pressed="pressed"
    :disabled="disabled"
  >
    <span class="icon" aria-hidden="true"><slot /></span>
  </button>
</template>

<style scoped>
.action-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--control-md);
  height: var(--control-md);
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-text-soft);
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    color var(--duration-fast) var(--ease-out);
}

.action-icon:hover {
  background: var(--color-surface-hover);
  color: var(--color-text);
}

.action-icon[aria-pressed='true'] {
  color: var(--color-accent);
}

.action-icon:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.icon {
  display: inline-flex;
  width: 1.5rem;
  height: 1.5rem;
}

.icon :slotted(svg) {
  width: 100%;
  height: 100%;
}
</style>
