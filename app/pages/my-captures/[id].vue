<script setup lang="ts">
// Edit of one's capture (/my-captures/{id}, US-12.1): private page, network only; a visitor signs in and comes back.
import EditCaptureForm from '~/features/captures/EditCaptureForm.vue'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
useHead({ title: () => t('captures.edit.title') })
const { me } = await useMe()
if (!me.value) await navigateTo({ path: localePath('/signin'), query: { redirect: route.fullPath } })
</script>

<template>
  <EditCaptureForm v-if="me" :photo-id="String(route.params.id)" />
</template>
