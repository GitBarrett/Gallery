<script setup lang="ts">
// /reset (SignIn mockup "forgot"): without a token, asks for the reset link, with the same answer whatever the
// email (US-04.1). Opened from the email, /reset#<token>: the token stays in the fragment (never in a server log)
// and leaves the address bar once read; the new password ends every session and signs in (US-04.3). A used or
// expired link leads back to the request (US-04.2). The new-password screen has no mockup: design system only.
import { api, ApiError, errorMessageKey } from '~/services/api'
import { signupError, type FormError } from './signup-errors'
import TurnstileCheck from './TurnstileCheck.vue'

const { t } = useI18n()
const localePath = useLocalePath()
const mode = ref<'request' | 'reset'>()
let token = ''
const email = ref('')
const password = ref('')
const turnstileToken = ref('')
const turnstile = ref<InstanceType<typeof TurnstileCheck>>()
const sent = ref(false)
const linkError = ref<'expired' | 'invalid'>()
const error = ref<FormError>()
const sending = ref(false)

onMounted(() => {
  token = window.location.hash.slice(1)
  history.replaceState(history.state, '', window.location.pathname)
  mode.value = token ? 'reset' : 'request'
})

function restart() {
  linkError.value = undefined
  error.value = undefined
  mode.value = 'request'
}

async function send(action: () => Promise<unknown>) {
  error.value = undefined
  sending.value = true
  try {
    await action()
  } catch (thrown) {
    if (thrown instanceof ApiError && thrown.details?.field === 'token')
      linkError.value = thrown.details.reason === 'expired' ? 'expired' : 'invalid'
    else {
      const refused = signupError(thrown)
      error.value = refused === 'invite_required' ? { key: errorMessageKey(thrown) } : refused
    }
  } finally {
    sending.value = false
  }
}

const requestLink = () =>
  send(async () => {
    try {
      await api.forgotPassword({ email: email.value, turnstileToken: turnstileToken.value })
      sent.value = true
    } finally {
      turnstile.value?.reset() // single-use token
    }
  })

const resetPassword = () =>
  send(async () => {
    await api.resetPassword({ token, password: password.value })
    await refreshNuxtData('me')
    await navigateTo(localePath('/'))
  })
</script>

<template>
  <div v-if="mode === 'request'" class="reset">
    <h1 id="reset-title" class="title">{{ t('auth.forgot.title') }}</h1>
    <p class="text">{{ t('auth.forgot.text') }}</p>
    <form class="reset" @submit.prevent="requestLink">
      <UiInput
        v-model="email"
        :label="t('auth.signup.email')"
        type="email"
        required
        autocomplete="email"
        maxlength="254"
      />
      <TurnstileCheck ref="turnstile" v-model="turnstileToken" action="forgot_password" />
      <p v-if="sent" role="status" class="sent">{{ t('auth.forgot.sent') }}</p>
      <p v-if="error" role="alert" class="error">{{ t(error.key) }}</p>
      <UiButton type="submit" size="lg" block :disabled="sending || !turnstileToken">
        {{ t('auth.forgot.submit') }}
      </UiButton>
      <UiButton variant="ghost" :to="localePath('/signin')">{{ t('auth.forgot.back') }}</UiButton>
    </form>
  </div>
  <div v-else-if="mode === 'reset'" class="reset">
    <h1 id="reset-title" class="title">{{ t('auth.reset.title') }}</h1>
    <template v-if="linkError">
      <p role="alert" class="text">{{ t(`auth.reset.${linkError}`) }}</p>
      <UiButton size="lg" block @click="restart">{{ t('auth.reset.again') }}</UiButton>
    </template>
    <form v-else class="reset" @submit.prevent="resetPassword">
      <p class="text">{{ t('auth.reset.text') }}</p>
      <UiInput
        v-model="password"
        :label="t('auth.reset.password')"
        type="password"
        required
        autocomplete="new-password"
        maxlength="512"
        :hint="t('auth.signup.passwordHint')"
        :error="error?.field === 'password' ? t(error.key) : undefined"
      />
      <p v-if="error && error.field !== 'password'" role="alert" class="error">{{ t(error.key) }}</p>
      <UiButton type="submit" size="lg" block :disabled="sending">{{ t('auth.reset.submit') }}</UiButton>
    </form>
  </div>
</template>

<style scoped>
.reset {
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

.sent {
  margin: 0;
  color: var(--color-success);
}

.error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}
</style>
