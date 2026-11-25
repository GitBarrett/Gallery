<script setup lang="ts">
// « My captures » (/my-captures, US-14.4): the member's captures and their status. Private page, never cached by the
// service worker; a visitor is sent to sign in and comes back here (Q49).
import MyCaptures from '~/features/captures/MyCaptures.vue'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
useHead({ title: () => t('captures.title') })
const { me } = await useMe()
if (!me.value) await navigateTo({ path: localePath('/signin'), query: { redirect: route.fullPath } })
</script>

<template>
  <MyCaptures v-if="me" :username="me.username" />
</template>
