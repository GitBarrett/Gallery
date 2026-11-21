<script setup lang="ts">
// Design system button (Main and SignIn mockups): main action in gold, secondary outlined, ghost discreet.
// Becomes a link when it leads to a page; disabled, it stays a button (a link has no disabled state).
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'md' | 'lg'
    to?: string
    type?: 'button' | 'submit' | 'reset'
    disabled?: boolean
    block?: boolean
  }>(),
  { variant: 'primary', size: 'md', to: undefined, type: 'button' },
)
</script>

<template>
  <NuxtLink v-if="to && !disabled" :to="to" class="button" :class="[variant, size, { block }]">
    <slot />
  </NuxtLink>
  <button v-else :type="type" :disabled="disabled" class="button" :class="[variant, size, { block }]">
    <slot />
  </button>
</template>

<style scoped>
.button {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: center;
  min-height: var(--control-md);
  padding: 0 var(--space-4);
  border: var(--border-width) solid transparent;
  border-radius: var(--radius-md);
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  text-decoration: none;
  cursor: pointer;
  transition:
    background-color var(--duration-fast) var(--ease-out),
    border-color var(--duration-fast) var(--ease-out);
}

.lg {
  min-height: var(--control-xl);
  padding: 0 var(--space-6);
  font-size: var(--text-lg);
}

.block {
  width: 100%;
}

.primary {
  background: var(--color-accent);
  color: var(--color-on-accent);
}

.secondary {
  border-color: var(--color-border);
  background: transparent;
  color: var(--color-text);
}

.secondary:hover {
  background: var(--color-surface-hover);
}

.ghost {
  background: transparent;
  color: var(--color-text-soft);
}

.ghost:hover {
  color: var(--color-text);
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
