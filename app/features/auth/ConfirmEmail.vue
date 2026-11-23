<script setup lang="ts">
// Link of the email change, /confirm-email#<token> (US-07.2), no mockup: design system only. The token stays in the
// fragment (never in a server log) and leaves the address bar once read. Signs nobody in: a member goes on to the
// settings, a visitor to the sign-in page.
import { api, ApiError, errorMessageKey } from '~/services/api'

const { t } = useI18n()
const localePath = useLocalePath()
const { me } = await useMe()
const state = ref<'checking' | 'done' | 'expired' | 'invalid' | 'taken' | 'error'>('checking')
const error = ref<string>()

onMounted(async () => {
  const token = window.location.hash.slice(1)
  history.replaceState(history.state, '', window.location.pathname)
  if (!token) return void (state.value = 'invalid')
  try {
    await api.confirmEmail({ token })
    state.value = 'done'
  } catch (thrown) {
    const reason = thrown instanceof ApiError && thrown.details?.field === 'token' ? thrown.details.reason : undefined
    if (reason === 'expired' || reason === 'taken' || reason === 'invalid') state.value = reason
    else {
      state.value = 'error'
      error.value = errorMessageKey(thrown)
    }
  }
})
</script>

<template>
  <div class="confirm">
    <h1 id="confirm-title" class="title">{{ t('auth.confirmEmail.title') }}</h1>
    <p v-if="state === 'checking'" role="status" class="text">{{ t('auth.confirmEmail.checking') }}</p>
    <p v-else-if="state === 'done'" role="status" class="text">{{ t('auth.confirmEmail.done') }}</p>
    <p v-else-if="state === 'error'" role="alert" class="text">{{ t(error!) }}</p>
    <p v-else role="alert" class="text">{{ t(`auth.confirmEmail.${state}`) }}</p>
    <UiButton v-if="state !== 'checking'" :to="localePath(me ? '/settings' : '/signin')">
      {{ me ? t('auth.confirmEmail.settings') : t('auth.confirmEmail.signIn') }}
    </UiButton>
  </div>
</template>

<style scoped>
.confirm {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.text {
  margin: 0;
  color: var(--color-text-soft);
}
</style>
