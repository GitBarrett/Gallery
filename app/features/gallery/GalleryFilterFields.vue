<script setup lang="ts">
// Filters of the PLP (US-20.3, Category mockup): zone of the dictionary (suggested while typing, as at upload), time
// of day, minimum quality with its « ? » (US-71.1), sort. Each change is emitted at once; the page writes it to the
// URL. Ids from useId(): the bar and the mobile sheet may both be in the page.
import { GRID_SORTS } from '~~/shared/domain/grid-sort'
import { QUALITIES, type QualityThresholds } from '~~/shared/domain/quality'
import { TIMES_OF_DAY } from '~~/shared/domain/time-of-day'
import { useZoneSuggestions } from '~/features/upload/useZoneSuggestions'
import type { GalleryFilters } from './filters'
import QualityHelp from './QualityHelp.vue'

const props = defineProps<{ filters: GalleryFilters; zoneName?: string; thresholds: QualityThresholds | null }>()
const emit = defineEmits<{ change: [filters: GalleryFilters] }>()
const { t } = useI18n()
const id = useId()
const zoneText = ref(props.zoneName ?? '')
const { zones, nameOf, read } = useZoneSuggestions(zoneText)

const set = (more: GalleryFilters) => emit('change', { ...props.filters, ...more })
// A text that is no zone of the dictionary filters nothing (free zones are not filterable, Q82)
const applyZone = () => set({ zone: read().zone })
const selected = (event: Event) => (event.target as HTMLSelectElement).value || undefined
const minQuality = computed(() => props.filters.minQuality ?? 'poor')
</script>

<template>
  <div class="fields">
    <div class="field">
      <label :for="`${id}-zone`" class="label">{{ t('gallery.filters.zone') }}</label>
      <input
        :id="`${id}-zone`"
        v-model="zoneText"
        type="search"
        class="control"
        :list="`${id}-zones`"
        :placeholder="t('gallery.filters.allZones')"
        autocomplete="off"
        @change="applyZone"
      />
      <datalist :id="`${id}-zones`">
        <option v-for="zone in zones" :key="zone.slug" :value="nameOf(zone)"></option>
      </datalist>
    </div>
    <div class="field">
      <label :for="`${id}-time`" class="label">{{ t('gallery.filters.time') }}</label>
      <select
        :id="`${id}-time`"
        class="control"
        :value="filters.timeOfDay ?? ''"
        @change="set({ timeOfDay: selected($event) as GalleryFilters['timeOfDay'] })"
      >
        <option value="">{{ t('gallery.filters.anyTime') }}</option>
        <option v-for="time in TIMES_OF_DAY" :key="time" :value="time">{{ t(`gallery.filters.times.${time}`) }}</option>
      </select>
    </div>
    <fieldset class="field quality">
      <legend class="label">
        {{ t('gallery.filters.quality') }}
        <QualityHelp :thresholds="thresholds" />
      </legend>
      <div class="tiers">
        <button
          v-for="quality in QUALITIES"
          :key="quality"
          type="button"
          class="tier"
          :class="quality"
          :aria-pressed="minQuality === quality"
          @click="set({ minQuality: quality })"
        >
          {{ t(`quality.${quality}`) }}
        </button>
      </div>
    </fieldset>
    <div class="field">
      <label :for="`${id}-sort`" class="label">{{ t('gallery.filters.sort') }}</label>
      <select
        :id="`${id}-sort`"
        class="control"
        :value="filters.sort ?? 'recent'"
        @change="set({ sort: selected($event) as GalleryFilters['sort'] })"
      >
        <option v-for="sort in GRID_SORTS" :key="sort" :value="sort">{{ t(`gallery.filters.sorts.${sort}`) }}</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.fields {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: flex-end;
}

.field {
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

.control {
  min-height: var(--control-md);
  padding: 0 var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text);
}

.control:focus-visible {
  box-shadow: var(--focus-ring);
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
