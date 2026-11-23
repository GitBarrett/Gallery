<script setup lang="ts">
import PublicProfile from '~/features/profile/PublicProfile.vue'
import { useProfile } from '~/features/profile/useProfile'

// Public profile /u/{username} (US-05.3): any case; an unknown, banned or deleted account is the 404 page
const route = useRoute()
const { me } = await useMe()
const { profile } = await useProfile(computed(() => String(route.params.username)))
if (!profile.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
const own = computed(() => me.value?.username.toLowerCase() === profile.value?.username.toLowerCase())
useHead({ title: () => profile.value?.username ?? '' })
</script>

<template>
  <PublicProfile v-if="profile" :profile="profile" :own="own" />
</template>
