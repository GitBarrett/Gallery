<script setup lang="ts">
import PublicProfile from '~/features/profile/PublicProfile.vue'
import { useProfile } from '~/features/profile/useProfile'

// Public profile /u/{username} (US-05.3): any case; an unknown, banned or deleted account is the 404 page
const route = useRoute()
const { me } = await useMe()
const { profile } = await useProfile(computed(() => String(route.params.username)))
if (!profile.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
// A former username (90 days, US-05.4): the API answers with the current one, the old URL redirects to it
if (profile.value.username.toLowerCase() !== String(route.params.username).toLowerCase())
  await navigateTo(useLocalePath()(`/u/${profile.value.username}`), { redirectCode: 301, replace: true })
const own = computed(() => me.value?.username.toLowerCase() === profile.value?.username.toLowerCase())
const { t } = useI18n()
const username = () => profile.value?.username ?? ''
usePageHead({
  title: username,
  description: () => t('profile.description', { username: username() }),
  path: () => `/u/${username()}`,
})
</script>

<template>
  <PublicProfile v-if="profile" :profile="profile" :own="own" />
</template>
