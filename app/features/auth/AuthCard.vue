<script setup lang="ts">
// Card of the SignIn mockup, shared by /signin and /signup. Its "Sign in" / "Create account" switch is made of
// links rather than ARIA tabs: each opens its own page; the `redirect` query follows. No switch once a form is sent.
defineProps<{ tab?: 'signin' | 'signup' }>()
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const query = computed(() => (typeof route.query.redirect === 'string' ? { redirect: route.query.redirect } : {}))
</script>

<template>
  <section class="card">
    <nav v-if="tab" :aria-label="t('auth.tabs.label')" class="tabs">
      <NuxtLink
        v-for="each in ['signin', 'signup'] as const"
        :key="each"
        :to="{ path: localePath(`/${each}`), query }"
        :aria-current="each === tab ? 'page' : undefined"
        class="tab"
        >{{ t(`auth.tabs.${each}`) }}</NuxtLink
      >
    </nav>
    <slot />
  </section>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: var(--auth-card-max);
  margin: var(--space-8) auto;
  padding: var(--space-6);
  border: var(--border-width) solid var(--color-border-subtle);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-raised);
}

.tabs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-bottom: var(--border-width) solid var(--color-border-subtle);
}

.tab {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--control-md);
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-family: var(--font-display);
  font-size: var(--text-md);
  font-weight: var(--weight-bold);
  text-decoration: none;
}

.tab[aria-current='page'] {
  border-bottom-color: var(--color-accent);
  color: var(--color-text);
}
</style>
