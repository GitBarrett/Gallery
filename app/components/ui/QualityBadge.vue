<script setup lang="ts">
// Capture quality badge (Identite and Photo mockups). The tier name is always written, never conveyed by colour
// alone (US-75.5); dark background and border so it stays readable on any photo (07-design.md § Texte sur image).
import type { Quality } from '../../../shared/domain/quality'

defineProps<{ quality: Quality; label: string }>()
</script>

<template>
  <span class="quality-badge" :style="{ '--tier': `var(--quality-${quality})` }">{{ label }}</span>
</template>

<style scoped>
.quality-badge {
  display: inline-block;
  padding: var(--space-1) var(--space-2);
  border: var(--border-width) solid var(--tier);
  border-radius: var(--radius-sm);
  background: var(--color-veil);
  color: var(--tier);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-tight);
  white-space: nowrap;
}
</style>
