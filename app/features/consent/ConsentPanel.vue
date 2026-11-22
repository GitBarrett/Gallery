<script setup lang="ts">
// Cookie panel (US-61, docs/legal/cookies.md): on a first visit, a banner at the top of the page with three
// buttons of equal weight; "Customise" and the footer's "Cookie settings" open the dialog with one switch per
// optional category. No mockup: composed with the design system. Advertising joins with its network (v1.x).
const { t } = useI18n()
const localePath = useLocalePath()
const { consent, pending, panelOpen, choose } = useConsent()
const analytics = ref(false)
watch(panelOpen, (open) => {
  if (open) analytics.value = consent.value?.analytics ?? false
})
</script>

<template>
  <section v-if="pending" :aria-label="t('consent.title')" class="banner">
    <div class="inner">
      <div>
        <h2 class="title">{{ t('consent.title') }}</h2>
        <p class="text">{{ t('consent.text') }}</p>
      </div>
      <div class="actions">
        <UiButton variant="secondary" @click="choose(true)">{{ t('consent.acceptAll') }}</UiButton>
        <UiButton variant="secondary" @click="choose(false)">{{ t('consent.rejectAll') }}</UiButton>
        <UiButton variant="secondary" @click="panelOpen = true">{{ t('consent.customise') }}</UiButton>
      </div>
    </div>
  </section>
  <UiModal v-model:open="panelOpen" :title="t('consent.title')" :close-label="t('consent.close')">
    <p class="text">{{ t('consent.text') }}</p>
    <label class="option">
      <input v-model="analytics" type="checkbox" role="switch" class="switch" />
      <span>
        <strong class="name">{{ t('consent.analytics') }}</strong>
        <span class="text">{{ t('consent.analyticsDescription') }}</span>
      </span>
    </label>
    <p class="text">
      <NuxtLink :to="localePath('/cookies')" class="policy">{{ t('consent.policy') }}</NuxtLink>
    </p>
    <template #actions>
      <UiButton @click="choose(analytics)">{{ t('consent.save') }}</UiButton>
    </template>
  </UiModal>
</template>

<style scoped>
.banner {
  border-bottom: var(--border-width) solid var(--color-border-subtle);
  background: var(--color-surface);
}

.inner {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-6);
  align-items: center;
  justify-content: space-between;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-4) max(var(--space-4), env(safe-area-inset-right)) var(--space-4)
    max(var(--space-4), env(safe-area-inset-left));
}

.title {
  margin: 0 0 var(--space-1);
  font-family: var(--font-display);
  font-size: var(--text-lg);
}

.text {
  display: block;
  margin: 0;
  color: var(--color-text-soft);
  font-size: var(--text-sm);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.option {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  min-height: var(--control-md);
  margin: var(--space-4) 0;
  cursor: pointer;
}

.switch {
  flex: none;
  width: var(--space-6);
  height: var(--space-6);
  margin: 0;
  accent-color: var(--color-accent);
}

.name {
  display: block;
}

.policy {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-md);
  color: var(--color-accent);
}
</style>
