<script setup lang="ts">
// Minimum quality filter (US-20.3, US-21.1) with its « ? » (US-71.1): the five tiers, the one chosen pressed; shared
// by the filters of the PLP and of the search.
import { QUALITIES, type Quality, type QualityThresholds } from '~~/shared/domain/quality'
import QualityHelp from './QualityHelp.vue'

defineProps<{ quality: Quality; thresholds: QualityThresholds | null }>()
const emit = defineEmits<{ select: [quality: Quality] }>()
const { t } = useI18n()
</script>

<template>
  <fieldset class="quality">
    <legend class="label">
      {{ t('gallery.filters.quality') }}
      <QualityHelp :thresholds="thresholds" />
    </legend>
    <div class="tiers">
      <button
        v-for="tier in QUALITIES"
        :key="tier"
        type="button"
        class="tier"
        :class="tier"
        :aria-pressed="quality === tier"
        @click="emit('select', tier)"
      >
        {{ t(`quality.${tier}`) }}
      </button>
    </div>
  </fieldset>
</template>

<style scoped>
.quality {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.label {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  padding: 0;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.tiers {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.tier {
  min-width: var(--control-md);
  min-height: var(--control-md);
  padding: 0 var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  font-size: var(--text-sm);
  cursor: pointer;
}

.tier:focus-visible {
  box-shadow: var(--focus-ring);
}

.tier[aria-pressed='true'] {
  border-color: currentcolor;
  background: var(--color-surface-raised);
}

.tier.poor {
  color: var(--quality-poor);
}

.tier.uncommon {
  color: var(--quality-uncommon);
}

.tier.rare {
  color: var(--quality-rare);
}

.tier.epic {
  color: var(--quality-epic);
}

.tier.legendary {
  color: var(--quality-legendary);
}
</style>
