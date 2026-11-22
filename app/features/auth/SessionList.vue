<script setup lang="ts">
// Devices of the member (US-03.7–9): each active session with its readable device; the current one is signed out
// with the Sign out button of the page, the others one by one or all at once. Loaded in the browser only.
import type { SessionsResponse } from '~~/shared/contracts/auth'
import { api, errorMessageKey } from '~/services/api'

type Session = SessionsResponse['sessions'][number]

const { t, locale } = useI18n()
const sessions = ref<Session[]>()
const error = ref<string>()
const sending = ref(false)

const deviceOf = ({ device: { browser, os } }: Session) =>
  browser && os ? t('settings.sessions.device', { browser, os }) : (browser ?? os ?? t('settings.sessions.unknown'))
const dateOf = (iso: string) =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

async function run(action: () => Promise<unknown>) {
  error.value = undefined
  sending.value = true
  try {
    await action()
    sessions.value = (await api.sessions()).sessions
  } catch (thrown) {
    error.value = errorMessageKey(thrown)
  } finally {
    sending.value = false
  }
}

onMounted(() => run(async () => {}))
</script>

<template>
  <section class="sessions" aria-labelledby="sessions-title">
    <h2 id="sessions-title" class="title">{{ t('settings.sessions.title') }}</h2>
    <ul v-if="sessions" class="list">
      <li v-for="session in sessions" :key="session.id" class="session">
        <div class="device">
          <p class="name">
            {{ deviceOf(session) }}
            <strong v-if="session.current" class="current">{{ t('settings.sessions.current') }}</strong>
          </p>
          <p class="dates">
            {{ t('settings.sessions.opened', { date: dateOf(session.createdAt) }) }} ·
            {{ t('settings.sessions.lastSeen', { date: dateOf(session.lastSeenAt) }) }}
          </p>
        </div>
        <UiButton
          v-if="!session.current"
          variant="ghost"
          :disabled="sending"
          :aria-label="t('settings.sessions.revokeLabel', { device: deviceOf(session) })"
          @click="run(() => api.revokeSession(session.id))"
          >{{ t('settings.sessions.revoke') }}</UiButton
        >
      </li>
    </ul>
    <UiButton
      v-if="sessions && sessions.length > 1"
      variant="secondary"
      :disabled="sending"
      @click="run(api.revokeOtherSessions)"
      >{{ t('settings.sessions.revokeOthers') }}</UiButton
    >
    <p v-if="error" class="error" role="alert">{{ t(error) }}</p>
  </section>
</template>

<style scoped>
.sessions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: flex-start;
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.session {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.device {
  min-width: 0;
}

.name,
.dates {
  margin: 0;
}

.current {
  margin-left: var(--space-2);
  color: var(--color-accent);
  font-size: var(--text-sm);
}

.dates {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}
</style>
