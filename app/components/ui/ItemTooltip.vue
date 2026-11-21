<script setup lang="ts">
// Item-style tooltip for capture details (Identite mockup): night-blue panel, silver border, title in the quality
// colour, green "Use:" line, author caption in yellow italic. Panel only: the caller shows it on hover and focus,
// or inside a BottomSheet on touch (US-67.3).
import type { Quality } from '../../../shared/domain/quality'

defineProps<{ title: string; quality: Quality; use?: string; caption?: string; credit?: string }>()
</script>

<template>
  <div class="item-tooltip" :style="{ '--tier': `var(--quality-${quality})` }">
    <p class="title">{{ title }}</p>
    <div v-if="$slots.default" class="details"><slot /></div>
    <p v-if="use" class="use">{{ use }}</p>
    <p v-if="caption" class="caption">{{ caption }}</p>
    <p v-if="credit" class="credit">{{ credit }}</p>
  </div>
</template>

<style scoped>
.item-tooltip {
  max-width: 340px;
  padding: var(--space-3);
  border: var(--border-width) solid var(--color-tooltip-border);
  border-radius: var(--radius-md);
  background: var(--color-tooltip-bg);
  box-shadow: var(--shadow-tooltip);
  color: var(--color-white);
  font-size: var(--text-md);
  line-height: var(--leading-normal);
}

p {
  margin: 0;
}

.title {
  color: var(--tier);
  font-size: var(--text-xl);
  font-weight: var(--weight-semibold);
}

.use,
.caption,
.credit {
  margin-top: var(--space-1-5);
}

.use {
  color: var(--quality-uncommon);
}

.caption {
  color: var(--color-tooltip-caption);
  font-style: italic;
}

.credit {
  color: var(--color-text-muted);
}
</style>
