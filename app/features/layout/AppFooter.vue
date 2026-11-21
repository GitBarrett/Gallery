<script setup lang="ts">
// Site footer (Footer mockup): legal links and the language switch (US-62.2), named in its own language. "Report a
// bug" comes with T-60; the ad slot and "Support the site" with their flag (v1.x).
const { t, locale, locales } = useI18n()
const localePath = useLocalePath()
const switchLocalePath = useSwitchLocalePath()

const links = computed(() => [
  { to: localePath('/legal'), label: t('layout.legalNotice') },
  { to: localePath('/terms'), label: t('layout.terms') },
  { to: localePath('/privacy'), label: t('layout.privacy') },
  { to: localePath('/cookies'), label: t('layout.cookieSettings') },
])
// shortcut: before hydration (or without JS), going from /fr to / is sent back to /fr by the cookie; add a server
// route that sets the cookie if users report it
const other = computed(() => locales.value.find((l) => l.code !== locale.value)!)
</script>

<template>
  <footer class="footer">
    <nav :aria-label="t('layout.footerNav')" class="links">
      <NuxtLink v-for="link in links" :key="link.to" :to="link.to" class="link">{{ link.label }}</NuxtLink>
      <NuxtLink :to="switchLocalePath(other.code)" :lang="other.language" :hreflang="other.language" class="link">
        {{ other.name }}
      </NuxtLink>
    </nav>
    <p class="brand">© Legendary Shots</p>
  </footer>
</template>

<style scoped>
.footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-6);
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-6) max(var(--space-4), env(safe-area-inset-right)) var(--space-6)
    max(var(--space-4), env(safe-area-inset-left));
  border-top: var(--border-width) solid var(--color-border-subtle);
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.links {
  display: flex;
  flex-wrap: wrap;
  column-gap: var(--space-4);
}

.link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--control-md);
  min-height: var(--control-md);
  color: inherit;
  text-decoration: none;
}

.link:hover {
  color: var(--color-text);
  text-decoration: underline;
}
</style>
