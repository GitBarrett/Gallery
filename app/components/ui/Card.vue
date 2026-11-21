<script setup lang="ts">
// Surface encadrée (maquette Main) ; la balise suit le contexte : article pour une capture, section pour un bloc.
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
