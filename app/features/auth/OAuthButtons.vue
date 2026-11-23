<script setup lang="ts">
// Provider buttons of the SignIn mockup, above the email form (US-02). A plain link: /auth/google is a server
// route that redirects to Google. It carries the language of the page and the beta invitation (US-56.4).
// Google button per its branding guidelines: official "G" logo, white, "Continue with Google". Battle.net: T-15.
const { t, locale } = useI18n()
const route = useRoute()
const href = computed(() => {
  const invite = route.query.invite
  const query = new URLSearchParams({ locale: locale.value === 'fr' ? 'fr' : 'en' })
  if (typeof invite === 'string' && invite) query.set('invite', invite)
  return `/auth/google?${query}`
})
</script>

<template>
  <div class="providers">
    <a :href="href" class="google">
      <img src="/brand/google-g.svg" alt="" width="20" height="20" />{{ t('auth.oauth.google') }}
    </a>
    <p class="or" aria-hidden="true">{{ t('auth.oauth.or') }}</p>
  </div>
</template>

<style scoped>
.providers {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.google {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: center;
  min-height: var(--control-lg);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-white);
  color: var(--color-google-text);
  font-weight: var(--weight-semibold);
  text-decoration: none;
}

.or {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  margin: 0;
  color: var(--color-text-faint);
  font-size: var(--text-sm);
}

.or::before,
.or::after {
  flex: 1;
  border-top: var(--border-width) solid var(--color-border-subtle);
  content: '';
}
</style>
