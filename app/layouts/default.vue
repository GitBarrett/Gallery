<script setup lang="ts">
// Shared layout: skip link first (US-75.1), header, content, footer and, below 768 px, the tab bar (US-67.1).
// shortcut: English text, moved to i18n in T-07b
import AppFooter from '~/features/layout/AppFooter.vue'
import AppHeader from '~/features/layout/AppHeader.vue'
import AppTabBar from '~/features/layout/AppTabBar.vue'

const flags = useFeatureFlags()
// shortcut: always signed out, the username comes from the session in T-12a
const username = undefined
</script>

<template>
  <div class="layout">
    <a href="#content" class="skip-link">Skip to content</a>
    <AppHeader :flags="flags" :username="username" />
    <main id="content" tabindex="-1" class="content"><slot /></main>
    <AppFooter />
    <AppTabBar :flags="flags" :username="username" />
  </div>
</template>

<style scoped>
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100svh;
}

.skip-link {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  z-index: var(--z-toast);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-weight: var(--weight-semibold);
  transform: translateY(-200%);
}

.skip-link:focus {
  transform: none;
}

.content {
  flex: 1;
  width: 100%;
  max-width: var(--content-max);
  margin: 0 auto;
  padding: var(--space-4) max(var(--space-4), env(safe-area-inset-right)) var(--space-8)
    max(var(--space-4), env(safe-area-inset-left));
}

.content:focus {
  outline: none;
}

/* Room for the fixed tab bar */
@media (width < 768px) {
  .layout {
    padding-bottom: calc(var(--tab-bar-height) + env(safe-area-inset-bottom));
  }
}
</style>
