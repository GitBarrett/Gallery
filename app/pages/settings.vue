<script setup lang="ts">
// Account settings (/settings, to be designed: 07-design.md). Username (T-16b), bio and language (T-17a), sign-out and
// devices (Q51), social networks (T-17d), email (T-17b), password (T-17c), the other settings with US-07 and US-09. A visitor is sent to sign in and comes back
// here (Q49).
import ChangeEmailForm from '~/features/auth/ChangeEmailForm.vue'
import ChangePasswordForm from '~/features/auth/ChangePasswordForm.vue'
import SessionList from '~/features/auth/SessionList.vue'
import SignoutButton from '~/features/auth/SignoutButton.vue'
import ProfileForm from '~/features/profile/ProfileForm.vue'
import SocialLinksForm from '~/features/profile/SocialLinksForm.vue'
import UsernameForm from '~/features/profile/UsernameForm.vue'
import { useProfile } from '~/features/profile/useProfile'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
useHead({ title: () => t('settings.title') })
const { me } = await useMe()
if (!me.value) await navigateTo({ path: localePath('/signin'), query: { redirect: route.fullPath } })
const { profile } = await useProfile(computed(() => me.value?.username ?? ''))
const sessionsVersion = ref(0) // reloads the devices once the other ones are signed out (US-07.3)
</script>

<template>
  <section class="settings" aria-labelledby="settings-title">
    <h1 id="settings-title" class="title">{{ t('settings.title') }}</h1>
    <UsernameForm v-if="me" :username="me.username" />
    <ProfileForm v-if="me && profile" :username="me.username" :bio="profile.bio" />
    <SocialLinksForm v-if="me" :username="me.username" />
    <ChangeEmailForm v-if="me" />
    <ChangePasswordForm v-if="me" @changed="sessionsVersion++" />
    <SignoutButton />
    <SessionList :key="sessionsVersion" />
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
