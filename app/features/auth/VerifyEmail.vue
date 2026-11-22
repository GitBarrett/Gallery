<script setup lang="ts">
// Link of the verification email, /verify-email#<token> (US-01.4): the token stays in the fragment (never in a
// server log) and leaves the address bar once read. A valid link verifies the email, signs in (Q44) and opens
// the profile. An expired link offers "Resend" to the signed-in member; a visitor signs in first (US-01.5, Q48).
import { api, ApiError, errorMessageKey } from '~/services/api'
import TurnstileCheck from './TurnstileCheck.vue'

const { t } = useI18n()
const localePath = useLocalePath()
const { me } = await useMe()
const state = ref<'checking' | 'expired' | 'invalid' | 'error'>('checking')
const error = ref<string>()
const turnstileToken = ref('')
const turnstile = ref<InstanceType<typeof TurnstileCheck>>()
const sending = ref(false)
const sent = ref(false)
const signInLink = `${localePath('/signin')}?redirect=${encodeURIComponent(localePath('/verify-email'))}`

onMounted(async () => {
  const token = window.location.hash.slice(1)
  history.replaceState(history.state, '', window.location.pathname)
  if (!token) return void (state.value = 'invalid')
  try {
    await api.verifyEmail({ token })
    await refreshNuxtData('me')
    // shortcut: settings until the public profile /u/<username> exists, T-16
    await navigateTo(localePath('/settings'))
  } catch (thrown) {
    if (thrown instanceof ApiError && thrown.details?.field === 'token')
      state.value = thrown.details.reason === 'expired' ? 'expired' : 'invalid'
    else {
      state.value = 'error'
      error.value = errorMessageKey(thrown)
    }
  }
})

async function resend() {
  error.value = undefined
  sending.value = true
  try {
    await api.resendVerification({ turnstileToken: turnstileToken.value })
    sent.value = true
  } catch (thrown) {
    error.value = errorMessageKey(thrown)
  } finally {
    sending.value = false
    turnstile.value?.reset() // single-use token
  }
}
</script>

<template>
  <div class="verify">
    <h1 id="verify-title" class="title">{{ t('auth.verify.title') }}</h1>
    <p v-if="state === 'checking'" role="status" class="text">{{ t('auth.verify.checking') }}</p>
    <template v-else-if="state !== 'error'">
      <p role="alert" class="text">{{ t(`auth.verify.${state}`) }}</p>
      <p v-if="sent" role="status" class="text">{{ t('auth.verify.sent') }}</p>
      <form v-else-if="me" class="form" @submit.prevent="resend">
        <TurnstileCheck ref="turnstile" v-model="turnstileToken" action="resend_verification" />
        <UiButton type="submit" size="lg" block :disabled="sending || !turnstileToken">
          {{ t('auth.verify.resend') }}
        </UiButton>
      </form>
      <UiButton v-else :to="signInLink">
        {{ t('auth.verify.signIn') }}
      </UiButton>
    </template>
    <p v-if="error" role="alert" class="error">{{ t(error) }}</p>
  </div>
</template>

<style scoped>
.verify,
.form {
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

.error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}
</style>
