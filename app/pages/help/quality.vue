<script setup lang="ts">
// /help/quality (07 § Qualité, point 7; linked from the « ? » of the filters, US-71.1, and from the first-capture
// notification, US-71.3): the whole explanation, the current thresholds read in site_settings (never written here,
// US-71.5), why they change, how likes are counted.
import { QUALITIES } from '~~/shared/domain/quality'

const { t, n } = useI18n()
const settings = usePublicSettings()
const rule = (quality: (typeof QUALITIES)[number]) => {
  if (quality === 'poor') return t('help.quality.start')
  const likes = settings.value?.qualityThresholds[quality]
  return likes === undefined ? '' : t('help.quality.from', { count: n(likes) })
}
usePageHead({
  title: () => t('help.quality.title'),
  description: () => t('help.quality.lead'),
  path: () => '/help/quality',
})
</script>

<template>
  <article class="help">
    <h1 class="title">{{ t('help.quality.title') }}</h1>
    <p class="lead">{{ t('help.quality.lead') }}</p>
    <section aria-labelledby="help-tiers">
      <h2 id="help-tiers" class="heading">{{ t('help.quality.tiers') }}</h2>
      <table class="table">
        <thead>
          <tr>
            <th scope="col">{{ t('help.quality.tier') }}</th>
            <th scope="col">{{ t('help.quality.likes') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="quality in QUALITIES" :key="quality">
            <th scope="row"><UiQualityBadge :quality="quality" :label="t(`quality.${quality}`)" /></th>
            <td>{{ rule(quality) }}</td>
          </tr>
        </tbody>
      </table>
    </section>
    <section aria-labelledby="help-change">
      <h2 id="help-change" class="heading">{{ t('help.quality.changeTitle') }}</h2>
      <p>{{ t('help.quality.change') }}</p>
    </section>
    <section aria-labelledby="help-count">
      <h2 id="help-count" class="heading">{{ t('help.quality.countTitle') }}</h2>
      <p>{{ t('help.quality.count') }}</p>
    </section>
  </article>
</template>

<style scoped>
.help {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 46rem;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4) var(--space-8);
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-3xl);
}

.heading {
  margin: 0 0 var(--space-2);
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.lead {
  margin: 0;
  color: var(--color-text-soft);
}

p {
  margin: 0;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: var(--border-width) solid var(--color-border-subtle);
  text-align: left;
}
</style>
