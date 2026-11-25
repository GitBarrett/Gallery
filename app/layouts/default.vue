<script setup lang="ts">
// Shared layout: skip link first (US-75.1), the cookie panel (US-61.1), header, content, footer and, below 768 px, the tab bar (US-67.1).
// It keeps the bell's counter fresh for the member (US-35.1).
import ConsentPanel from '~/features/consent/ConsentPanel.vue'
import AppFooter from '~/features/layout/AppFooter.vue'
import AppHeader from '~/features/layout/AppHeader.vue'
import AppTabBar from '~/features/layout/AppTabBar.vue'
import OfflineBanner from '~/features/layout/OfflineBanner.vue'
import InstallBanner from '~/features/pwa/InstallBanner.vue'
import UpdateToast from '~/features/pwa/UpdateToast.vue'
import { useUnreadPolling } from '~/features/notifications/useUnread'

const flags = useFeatureFlags()
const { me } = await useMe()
const username = computed(() => me.value?.username)
useUnreadPolling(computed(() => Boolean(me.value)))
</script>

<template>
  <div class="layout">
    <a href="#content" class="skip-link">{{ $t('layout.skipToContent') }}</a>
    <ConsentPanel />
    <AppHeader :flags="flags" :username="username" :avatar-url="me?.avatarUrl ?? null" />
    <OfflineBanner />
    <main id="content" tabindex="-1" class="content"><slot /></main>
    <InstallBanner />
    <AppFooter />
    <UpdateToast />
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
