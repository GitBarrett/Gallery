<script setup lang="ts">
// Provider buttons of the SignIn mockup, above the email form (US-02). Plain links: /auth/{provider} is a server
// route that redirects to the provider. They carry the language of the page and the beta invitation (US-56.4).
// Google button per its branding guidelines: official "G" logo, white, "Continue with Google". Battle.net: colors of
// the mockup, no logo until the official file is cleared (Q7).
const { t, locale } = useI18n()
const route = useRoute()
const query = computed(() => {
  const invite = route.query.invite
  const params = new URLSearchParams({ locale: locale.value === 'fr' ? 'fr' : 'en' })
  if (typeof invite === 'string' && invite) params.set('invite', invite)
  return params.toString()
})
</script>

<template>
  <div class="providers">
    <a :href="`/auth/battlenet?${query}`" class="provider battlenet">{{ t('auth.oauth.battlenet') }}</a>
    <a :href="`/auth/google?${query}`" class="provider google">
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

.provider {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: center;
  min-height: var(--control-lg);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  font-weight: var(--weight-semibold);
  text-decoration: none;
}

.battlenet {
  border-color: var(--color-battlenet-border);
  background: var(--color-battlenet-bg);
  color: var(--color-white);
}

.google {
  background: var(--color-white);
  color: var(--color-google-text);
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
