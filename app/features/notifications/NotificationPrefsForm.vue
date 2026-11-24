<script setup lang="ts">
// Notification preferences (Notifications mockup, US-07.5, US-35.4, Q69): one switch per type that can be turned off,
// saved on change; moderation decisions and quality tiers stay on. The weekly email digest is v1.x (US-36).
import { NOTIFICATION_PREFS, type NotificationPref, type NotificationPrefs } from '~~/shared/domain/notification-prefs'
import { api, errorMessageKey } from '~/services/api'

const { t } = useI18n()
const prefs = ref<NotificationPrefs>()
const saved = ref(false)
const error = ref<string>()

onMounted(async () => {
  try {
    prefs.value = (await api.account()).notificationPrefs
  } catch (thrown) {
    error.value = t(errorMessageKey(thrown))
  }
})

async function toggle(pref: NotificationPref, on: boolean) {
  saved.value = false
  error.value = undefined
  try {
    await api.updateMe({ notificationPrefs: { [pref]: on } })
    saved.value = true
  } catch (thrown) {
    prefs.value![pref] = !on
    error.value = t(errorMessageKey(thrown))
  }
}
</script>

<template>
  <section class="prefs" aria-labelledby="prefs-title">
    <h2 id="prefs-title" class="title">{{ t('notifications.prefs.title') }}</h2>
    <fieldset v-if="prefs" class="set">
      <legend class="legend">{{ t('notifications.prefs.legend') }}</legend>
      <label v-for="pref in NOTIFICATION_PREFS" :key="pref" class="option">
        <input
          v-model="prefs[pref]"
          type="checkbox"
          class="box"
          @change="toggle(pref, ($event.target as HTMLInputElement).checked)"
        />
        {{ t(`notifications.prefs.${pref}`) }}
      </label>
      <label class="option locked">
        <input type="checkbox" class="box" checked disabled />
        {{ t('notifications.prefs.moderation') }}
      </label>
    </fieldset>
    <p class="hint">{{ t('notifications.prefs.grouped') }}</p>
    <p v-if="saved" class="hint" role="status">{{ t('notifications.prefs.saved') }}</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.prefs,
.set {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.prefs {
  padding: var(--space-4);
  border: var(--border-width) solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.set {
  margin: 0;
  padding: 0;
  border: 0;
}

.legend {
  margin-bottom: var(--space-2);
  padding: 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.option {
  display: flex;
  gap: var(--space-2-5);
  align-items: center;
  min-height: var(--control-md);
}

.locked {
  color: var(--color-text-muted);
}

.box {
  width: 1.125rem;
  height: 1.125rem;
  accent-color: var(--color-accent);
}

.hint,
.error {
  margin: 0;
  font-size: var(--text-sm);
}

.hint {
  color: var(--color-text-faint);
}

.error {
  color: var(--color-danger);
}
</style>
