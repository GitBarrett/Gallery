<script setup lang="ts">
// Sign-up (US-01, SignIn mockup "Create account"). Every accepted request ends on the same "Check your inbox",
// a used email included (US-01.2); during the beta, a refusal without invitation opens the waiting list
// (US-56.4). Social buttons come with T-14/T-15, the sign-in tab is in AuthCard.
import { api } from '~/services/api'
import { localSignupError, signupError, type FormError } from './signup-errors'
import TurnstileCheck from './TurnstileCheck.vue'
import WaitlistForm from './WaitlistForm.vue'
import AuthCard from './AuthCard.vue'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const username = ref('')
const email = ref('')
const password = ref('')
const terms = ref(false)
const turnstileToken = ref('')
const turnstile = ref<InstanceType<typeof TurnstileCheck>>()
const error = ref<FormError>()
const sending = ref(false)
const step = ref<'form' | 'inbox' | 'waitlist'>('form')
const fieldError = (field: FormError['field']) => {
  const current = error.value
  return current && current.field === field ? t(current.key) : undefined
}

async function submit() {
  error.value = localSignupError(username.value, password.value)
  if (error.value) return
  sending.value = true
  try {
    const invite = route.query.invite
    await api.signup({
      email: email.value,
      username: username.value,
      password: password.value,
      termsAccepted: true,
      turnstileToken: turnstileToken.value,
      locale: locale.value === 'fr' ? 'fr' : 'en',
      ...(typeof invite === 'string' && invite ? { inviteToken: invite } : {}),
    })
    step.value = 'inbox'
  } catch (thrown) {
    const refused = signupError(thrown)
    if (refused === 'invite_required') step.value = 'waitlist'
    else error.value = refused
  } finally {
    sending.value = false
    turnstile.value?.reset() // single-use token
  }
}
</script>

<template>
  <AuthCard :tab="step === 'form' ? 'signup' : undefined" aria-labelledby="signup-title">
    <template v-if="step === 'form'">
      <h1 id="signup-title" class="title">{{ t('auth.signup.title') }}</h1>
      <form class="form" @submit.prevent="submit">
        <UiInput
          v-model="username"
          :label="t('auth.signup.username')"
          :hint="t('auth.signup.usernameHint')"
          :error="fieldError('username')"
          required
          autocomplete="username"
          maxlength="24"
        />
        <UiInput
          v-model="email"
          :label="t('auth.signup.email')"
          :error="fieldError('email')"
          type="email"
          required
          autocomplete="email"
          maxlength="254"
        />
        <UiInput
          v-model="password"
          :label="t('auth.signup.password')"
          :hint="t('auth.signup.passwordHint')"
          :error="fieldError('password')"
          type="password"
          required
          autocomplete="new-password"
          maxlength="128"
        />
        <label class="terms">
          <input v-model="terms" type="checkbox" required class="checkbox" />
          <span>{{ t('auth.signup.terms') }}</span>
        </label>
        <p class="policies">
          <NuxtLink :to="localePath('/terms')" class="link">{{ t('auth.signup.termsLink') }}</NuxtLink>
          <NuxtLink :to="localePath('/privacy')" class="link">{{ t('auth.signup.privacyLink') }}</NuxtLink>
        </p>
        <TurnstileCheck ref="turnstile" v-model="turnstileToken" action="signup" />
        <p v-if="fieldError('turnstileToken')" class="error" role="alert">{{ fieldError('turnstileToken') }}</p>
        <p v-if="error && !error.field" class="error" role="alert">{{ t(error.key) }}</p>
        <UiButton type="submit" size="lg" block :disabled="sending || !turnstileToken">
          {{ t('auth.signup.submit') }}
        </UiButton>
        <p class="note">{{ t('auth.signup.note') }}</p>
      </form>
    </template>
    <div v-else-if="step === 'inbox'" role="status">
      <h1 id="signup-title" class="title">{{ t('auth.signup.inboxTitle') }}</h1>
      <p class="text">{{ t('auth.signup.inboxText') }}</p>
    </div>
    <WaitlistForm v-else :email="email" />
  </AuthCard>
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

.terms {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  min-height: var(--control-md);
  font-size: var(--text-sm);
  cursor: pointer;
}

.checkbox {
  flex: none;
  width: var(--space-5);
  height: var(--space-5);
  margin: 0;
  accent-color: var(--color-accent);
}

.policies {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-4);
  margin: 0;
  font-size: var(--text-sm);
}

.link {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-md);
  min-width: var(--control-md);
  justify-content: center;
  color: var(--color-accent);
}

.error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.text,
.note {
  margin: 0;
  color: var(--color-text-soft);
  font-size: var(--text-sm);
}
</style>
