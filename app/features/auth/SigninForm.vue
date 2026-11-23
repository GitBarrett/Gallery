<script setup lang="ts">
// Sign-in by password (US-03, SignIn mockup "Sign in"). One message for any wrong credentials (US-03.2); the
// anti-bot check appears only once the server requires it (US-03.3, Q48). Provider buttons above (US-02); back from
// a failed OAuth sign-in, or to link an identity to the account of its email, a message says why (US-02.5, US-02.3).
import { api, ApiError, errorMessageKey } from '~/services/api'
import OAuthButtons from './OAuthButtons.vue'
import { safeRedirect } from './safe-redirect'
import TurnstileCheck from './TurnstileCheck.vue'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const email = ref('')
const password = ref('')
const needsTurnstile = ref(false)
const turnstileToken = ref('')
const turnstile = ref<InstanceType<typeof TurnstileCheck>>()
const error = ref<string | undefined>(route.query.oauth === 'failed' ? 'auth.oauth.failed' : undefined)
const linking = route.query.link === 'google'
const sending = ref(false)

function messageOf(thrown: unknown): string {
  if (!(thrown instanceof ApiError)) return errorMessageKey(thrown)
  if (thrown.details?.reason === 'invalid_credentials') return 'auth.signin.invalid'
  if (thrown.details?.field === 'turnstileToken') {
    needsTurnstile.value = true
    return thrown.details.reason === 'required' ? 'auth.signin.turnstileRequired' : 'auth.errors.turnstileToken.failed'
  }
  return errorMessageKey(thrown)
}

async function submit() {
  error.value = undefined
  sending.value = true
  try {
    await api.signin({
      email: email.value,
      password: password.value,
      ...(turnstileToken.value ? { turnstileToken: turnstileToken.value } : {}),
    })
    await refreshNuxtData('me')
    const target = safeRedirect(route.query.redirect)
    await navigateTo(target === '/' ? localePath('/') : target)
  } catch (thrown) {
    error.value = messageOf(thrown)
  } finally {
    sending.value = false
    turnstile.value?.reset() // single-use token
  }
}
</script>

<template>
  <OAuthButtons v-if="!linking" />
  <p v-else class="notice" role="status">{{ t('auth.oauth.linkNotice') }}</p>
  <form class="form" :aria-label="t('auth.signin.title')" @submit.prevent="submit">
    <UiInput
      v-model="email"
      :label="t('auth.signup.email')"
      type="email"
      required
      autocomplete="email"
      maxlength="254"
    />
    <UiInput
      v-model="password"
      :label="t('auth.signup.password')"
      type="password"
      required
      autocomplete="current-password"
      maxlength="512"
    >
      <template #action>
        <NuxtLink :to="localePath('/reset')" class="forgot">{{ t('auth.signin.forgot') }}</NuxtLink>
      </template>
    </UiInput>
    <TurnstileCheck v-if="needsTurnstile" ref="turnstile" v-model="turnstileToken" action="signin" />
    <p v-if="error" class="error" role="alert">{{ t(error) }}</p>
    <UiButton type="submit" size="lg" block :disabled="sending || (needsTurnstile && !turnstileToken)">
      {{ t('auth.signin.submit') }}
    </UiButton>
  </form>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* touch target of 44 px (US-67.5) without growing the text */
.forgot {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-md);
}

.notice {
  margin: 0;
  color: var(--color-text-soft);
}

.error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}
</style>
