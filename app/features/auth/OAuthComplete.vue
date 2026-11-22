<script setup lang="ts">
// Step after a first OAuth sign-in (US-02.1): username and Terms create the account. The email of an existing
// account is never merged: the member signs in to it, which links the identity (US-02.3). No mockup: design system.
import { validateUsername } from '~~/shared/domain/account-rules'
import { api, ApiError } from '~/services/api'
import { signupError, type FormError } from './signup-errors'
import TermsConsent from './TermsConsent.vue'
import WaitlistForm from './WaitlistForm.vue'

const { t, locale } = useI18n()
const localePath = useLocalePath()
// Client only: the sealed cookie of the flow is read by the API
const { data: pending, status } = await useAsyncData('oauth-pending', () => api.oauthPending(), { server: false })
const username = ref('')
const terms = ref(false)
const error = ref<FormError>()
const sending = ref(false)
const waitlist = ref(false)
const emailTaken = ref(false)

async function submit() {
  const name = validateUsername(username.value)
  error.value = name.ok ? undefined : { field: 'username', key: `auth.errors.username.${name.error}` }
  if (error.value) return
  sending.value = true
  try {
    await api.completeOAuth({
      username: username.value,
      termsAccepted: true,
      locale: locale.value === 'fr' ? 'fr' : 'en',
    })
    await refreshNuxtData('me')
    await navigateTo(localePath('/'))
  } catch (thrown) {
    if (thrown instanceof ApiError && thrown.code === 'CONFLICT' && thrown.details?.field === 'email') {
      emailTaken.value = true // an account of this email was created meanwhile (US-02.3)
      return
    }
    const refused = signupError(thrown)
    if (refused === 'invite_required') waitlist.value = true
    else error.value = refused
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <template v-if="status === 'error'">
    <h1 id="oauth-title" class="title">{{ t('auth.oauth.completeTitle') }}</h1>
    <p class="text" role="alert">{{ t('auth.oauth.expired') }}</p>
    <UiButton :to="localePath('/signin')" variant="secondary">{{ t('auth.forgot.back') }}</UiButton>
  </template>
  <template v-else-if="pending?.emailTaken || emailTaken">
    <h1 id="oauth-title" class="title">{{ t('auth.oauth.linkTitle') }}</h1>
    <p class="text">{{ t('auth.oauth.emailTaken', { email: pending?.email }) }}</p>
    <UiButton :to="`${localePath('/signin')}?link=google`" size="lg" block>{{ t('auth.oauth.signinToLink') }}</UiButton>
  </template>
  <WaitlistForm v-else-if="waitlist" :email="pending?.email ?? ''" />
  <form v-else-if="pending" class="form" aria-labelledby="oauth-title" @submit.prevent="submit">
    <h1 id="oauth-title" class="title">{{ t('auth.oauth.completeTitle') }}</h1>
    <p class="text">{{ t('auth.oauth.completeText') }}</p>
    <UiInput
      v-model="username"
      :label="t('auth.signup.username')"
      :hint="t('auth.signup.usernameHint')"
      :error="error?.field === 'username' ? t(error.key) : undefined"
      required
      autocomplete="username"
      maxlength="24"
    />
    <TermsConsent v-model="terms" />
    <p v-if="error && !error.field" class="error" role="alert">{{ t(error.key) }}</p>
    <UiButton type="submit" size="lg" block :disabled="sending">{{ t('auth.signup.submit') }}</UiButton>
  </form>
</template>

<style scoped>
.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
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
