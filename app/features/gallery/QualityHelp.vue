<script setup lang="ts">
// « ? » next to « Minimum quality » (US-71.1, Category mockup, 07 § Expliquer la qualité): the five tiers with the
// current thresholds of site_settings, never written here, and a link to /help/quality (T-43). A disclosure on every
// screen size (Q84): the button opens and closes it, Escape closes it.
import { QUALITIES, type QualityThresholds } from '~~/shared/domain/quality'

const props = defineProps<{ thresholds: QualityThresholds | null }>()
const { t, n } = useI18n()
const localePath = useLocalePath()
const open = ref(false)
const id = useId()
const tiers = computed(() =>
  QUALITIES.map((quality) => ({
    quality,
    rule:
      quality === 'poor'
        ? t('gallery.qualityHelp.newCapture')
        : props.thresholds && t('gallery.qualityHelp.likes', { count: n(props.thresholds[quality]) }),
  })),
)
</script>

<template>
  <span class="quality-help" @keydown.esc="open = false">
    <button
      type="button"
      class="toggle"
      :aria-expanded="open"
      :aria-controls="id"
      :aria-label="t('gallery.qualityHelp.open')"
      @click="open = !open"
    >
      ?
    </button>
    <div v-show="open" :id="id" class="panel" role="region" :aria-label="t('gallery.qualityHelp.title')">
      <p class="title">{{ t('gallery.qualityHelp.title') }}</p>
      <p class="text">{{ t('gallery.qualityHelp.text') }}</p>
      <ul class="tiers">
        <li v-for="tier in tiers" :key="tier.quality" class="tier">
          <span class="name" :class="tier.quality">{{ t(`quality.${tier.quality}`) }}</span>
          <span v-if="tier.rule" class="rule">{{ tier.rule }}</span>
        </li>
      </ul>
      <p class="note">
        {{ t('gallery.qualityHelp.note') }}
        <NuxtLink :to="localePath('/help/quality')">{{ t('gallery.qualityHelp.link') }}</NuxtLink>
      </p>
    </div>
  </span>
</template>

<style scoped>
.quality-help {
  position: relative;
  display: inline-block;
}

.toggle {
  width: var(--control-md);
  height: var(--control-md);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface-raised);
  color: var(--color-text);
  font-weight: var(--weight-bold);
  cursor: pointer;
}

.toggle:focus-visible {
  box-shadow: var(--focus-ring);
}

.panel {
  position: absolute;
  z-index: var(--z-header);
  top: calc(100% + var(--space-2));
  left: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: min(320px, calc(100vw - 2 * var(--space-4)));
  padding: var(--space-4);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  font-weight: var(--weight-regular);
}

.title,
.text,
.note {
  margin: 0;
}

.title {
  font-family: var(--font-display);
  font-weight: var(--weight-bold);
}

.text,
.note {
  color: var(--color-text-soft);
  font-size: var(--text-sm);
}

.tiers {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.tier {
  display: flex;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.rule {
  color: var(--color-text-faint);
}

.name.poor {
  color: var(--quality-poor);
}

.name.uncommon {
  color: var(--quality-uncommon);
}

.name.rare {
  color: var(--quality-rare);
}

.name.epic {
  color: var(--quality-epic);
}

.name.legendary {
  color: var(--quality-legendary);
}

.note a {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-md);
}
</style>
