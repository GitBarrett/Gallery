<script setup lang="ts">
// Sign-out (US-03.4): the server revokes the session and deletes the cookie, then the service worker empties the
// caches that may hold the member's pages (US-64.4, CLEAR_USER_CACHES) and the visitor goes home.
import { api, errorMessageKey } from '~/services/api'

const { t } = useI18n()
const localePath = useLocalePath()
const error = ref<string>()
const sending = ref(false)

async function signOut() {
  error.value = undefined
  sending.value = true
  try {
    await api.signout()
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_USER_CACHES' })
    await refreshNuxtData('me')
    await navigateTo(localePath('/'))
  } catch (thrown) {
    error.value = errorMessageKey(thrown)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="signout">
    <UiButton variant="secondary" :disabled="sending" @click="signOut">{{ t('auth.signout') }}</UiButton>
    <p v-if="error" class="error" role="alert">{{ t(error) }}</p>
  </div>
</template>

<style scoped>
.signout {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: flex-start;
}

.error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}
</style>
