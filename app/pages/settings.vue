<script setup lang="ts">
// Account settings (/settings, to be designed: 07-design.md). Only sign-out for now; sessions come with T-12d,
// the other settings with US-07 and US-09. A visitor is sent to sign in and comes back here (Q49).
import SignoutButton from '~/features/auth/SignoutButton.vue'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
useHead({ title: () => t('settings.title') })
const { me } = await useMe()
if (!me.value) await navigateTo({ path: localePath('/signin'), query: { redirect: route.fullPath } })
</script>

<template>
  <section class="settings" aria-labelledby="settings-title">
    <h1 id="settings-title" class="title">{{ t('settings.title') }}</h1>
    <SignoutButton />
  </section>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
}
</style>
