<script setup lang="ts">
// Framed surface (Main mockup); the tag follows the context: article for a capture, section for a block.
withDefaults(defineProps<{ as?: 'div' | 'article' | 'section' }>(), { as: 'div' })
</script>

<template>
  <component :is="as" class="card"><slot /></component>
</template>

<style scoped>
.card {
  padding: var(--space-4);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}
</style>
