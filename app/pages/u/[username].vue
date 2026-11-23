<script setup lang="ts">
import PublicProfile from '~/features/profile/PublicProfile.vue'
import { api, ApiError } from '~/services/api'

// Public profile /u/{username} (US-05.3): any case; an unknown, banned or deleted account is the 404 page
const route = useRoute()
const username = computed(() => String(route.params.username))
const fetch = useRequestFetch()
const { me } = await useMe()
const { data: profile } = await useAsyncData(
  () => `profile:${username.value.toLowerCase()}`,
  () =>
    api.profile(username.value, fetch).catch((error) => {
      if (error instanceof ApiError && error.code === 'NOT_FOUND') return null
      throw error
    }),
)
if (!profile.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
const own = computed(() => me.value?.username.toLowerCase() === profile.value?.username.toLowerCase())
useHead({ title: () => profile.value?.username ?? '' })
</script>

<template>
  <PublicProfile v-if="profile" :profile="profile" :own="own" />
</template>
