<script setup lang="ts">
// Counter of the bell (US-35.1), on the notifications link of the header and of the tab bar; hidden at 0. Screen
// readers hear "3 unread" after the link's label.
import { useUnread } from './useUnread'

const { t } = useI18n()
const unread = useUnread()
</script>

<template>
  <span v-if="unread > 0" class="badge">
    <span aria-hidden="true">{{ unread > 99 ? '99+' : unread }}</span>
    <span class="visually-hidden">{{ t('notifications.unreadCount', { count: unread }) }}</span>
  </span>
</template>

<style scoped>
.badge {
  position: absolute;
  top: var(--space-0-5);
  right: var(--space-0-5);
  min-width: 1.125rem;
  padding: 0 var(--space-1);
  border-radius: var(--radius-pill);
  background: var(--color-accent);
  color: var(--color-on-accent);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  line-height: 1.125rem;
  text-align: center;
}
</style>
