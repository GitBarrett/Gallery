<script setup lang="ts">
// Quest log (Notifications mockup, US-35.3): grouped Today / Earlier by the local day, unread with a yellow marker,
// read in grey; "All / Unread" filter, "Mark all as read". Following an entry's link marks it read. No thumbnail
// until the capture images are served (T-25a).
import type { NotificationItem } from '~~/shared/contracts/notifications'
import { api, errorMessageKey } from '~/services/api'
import { useUnread } from './useUnread'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const unread = useUnread()
const items = ref<NotificationItem[]>()
const unreadOnly = ref(false)
const error = ref<string>()

onMounted(async () => {
  try {
    items.value = (await api.notifications()).notifications
  } catch (thrown) {
    error.value = t(errorMessageKey(thrown))
  }
})

const unreadInList = computed(() => items.value?.filter((n) => !n.read).length ?? 0)

const groups = computed(() => {
  const today = new Date().toDateString()
  const shown = (items.value ?? []).filter((n) => !unreadOnly.value || !n.read)
  return [
    { key: 'today', items: shown.filter((n) => new Date(n.createdAt).toDateString() === today) },
    { key: 'earlier', items: shown.filter((n) => new Date(n.createdAt).toDateString() !== today) },
  ].filter((group) => group.items.length)
})

function text(n: NotificationItem) {
  const title = n.photoTitle ? t('notifications.quoted', { title: n.photoTitle }) : t('notifications.untitled')
  const values = { actor: n.actor, others: n.others, title }
  if (n.type === 'like') return t('notifications.text.like', values, n.others)
  if (n.type === 'quality')
    return t('notifications.text.quality', { title, quality: t(`notifications.quality.${n.detail}`) })
  if (n.type === 'moderation')
    return n.photoId
      ? t(`notifications.text.moderation.${n.detail}`, values)
      : t(`notifications.text.avatar.${n.detail}`)
  if (n.type === 'contest') return t(`notifications.text.contest.${n.detail}`)
  return t(`notifications.text.${n.type}`, values)
}

function link(n: NotificationItem): { to: string; label: string } {
  if (n.type === 'follow') return { to: `/u/${n.actor}`, label: t('notifications.cta.profile') }
  if (n.type === 'contest') return { to: '/contests', label: t('notifications.cta.contests') }
  if (n.type === 'moderation' && !n.photoId) return { to: '/settings', label: t('notifications.cta.settings') }
  // A failed capture is uploaded again (Q68); a rejected one can be appealed by email (US-50.1, Terms)
  if (n.type === 'moderation' && n.detail === 'failed') return { to: '/upload', label: t('notifications.cta.upload') }
  if (n.type === 'moderation' && n.detail === 'rejected') return { to: '/terms', label: t('notifications.cta.appeal') }
  return { to: `/p/${n.photoId}`, label: t('notifications.cta.view') }
}

function when(iso: string) {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000)
  const format = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  if (minutes > -60) return format.format(minutes, 'minute')
  if (minutes > -24 * 60) return format.format(Math.round(minutes / 60), 'hour')
  return format.format(Math.round(minutes / (24 * 60)), 'day')
}

function markRead(n: NotificationItem) {
  if (n.read) return
  n.read = true
  unread.value = Math.max(unread.value - 1, 0)
  api.markNotificationRead(n.id).catch(() => {}) // the page is left: a failure only keeps it unread
}

async function markAll() {
  error.value = undefined
  try {
    await api.markAllNotificationsRead()
    for (const n of items.value ?? []) n.read = true
    unread.value = 0
  } catch (thrown) {
    error.value = t(errorMessageKey(thrown))
  }
}
</script>

<template>
  <section class="quest-log" aria-labelledby="quest-log-title">
    <div class="head">
      <h1 id="quest-log-title" class="title">{{ t('notifications.title') }}</h1>
      <div class="actions">
        <div class="filter" role="group" :aria-label="t('notifications.filter')">
          <UiButton variant="secondary" :aria-pressed="!unreadOnly" @click="unreadOnly = false">
            {{ t('notifications.all') }}
          </UiButton>
          <UiButton variant="secondary" :aria-pressed="unreadOnly" @click="unreadOnly = true">
            {{ t('notifications.unreadTab', { count: unreadInList }) }}
          </UiButton>
        </div>
        <UiButton variant="ghost" :disabled="!unreadInList" @click="markAll">{{ t('notifications.markAll') }}</UiButton>
      </div>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <section v-for="group in groups" :key="group.key" class="group" :aria-labelledby="`group-${group.key}`">
      <h2 :id="`group-${group.key}`" class="group-title">{{ t(`notifications.${group.key}`) }}</h2>
      <ul class="list">
        <li v-for="n in group.items" :key="n.id" class="item" :class="{ unread: !n.read }">
          <UiQuestMarker
            kind="exclamation"
            :done="n.read"
            :label="n.read ? t('notifications.read') : t('notifications.unread')"
            class="marker"
          />
          <div class="body">
            <p class="text">{{ text(n) }}</p>
            <p class="when">
              <time :datetime="n.createdAt">{{ when(n.createdAt) }}</time>
            </p>
          </div>
          <NuxtLink :to="localePath(link(n).to)" class="cta" @click="markRead(n)">{{ link(n).label }}</NuxtLink>
        </li>
      </ul>
    </section>
    <UiEmptyState v-if="items && !groups.length" :title="t('notifications.empty')" />
  </section>
</template>

<style scoped>
.quest-log {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.head,
.actions,
.filter {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.head {
  justify-content: space-between;
  gap: var(--space-3);
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
}

.filter [aria-pressed='true'] {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.group-title {
  margin: var(--space-2) 0 0;
  color: var(--color-text-faint);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-3);
  border: var(--border-width) solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-soft);
}

.item.unread {
  border-color: var(--color-border);
  background: var(--color-surface-raised);
  color: var(--color-white);
}

.marker {
  flex: none;
  width: 1.125rem;
}

.body {
  flex: 1;
  min-width: 0;
}

.text,
.when {
  margin: 0;
}

.when {
  margin-top: var(--space-0-5);
  color: var(--color-text-faint);
  font-size: var(--text-xs);
}

.cta {
  display: inline-flex;
  flex: none;
  align-items: center;
  min-height: var(--control-md);
  font-weight: var(--weight-semibold);
  white-space: nowrap;
}

.error {
  margin: 0;
  color: var(--color-danger);
}
</style>
