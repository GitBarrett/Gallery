<script setup lang="ts">
// Quest log (/notifications, Notifications mockup, US-35.3) with the notification settings beside it (US-07.5, Q69).
// A visitor is sent to sign in and comes back here (Q49).
import NotificationPrefsForm from '~/features/notifications/NotificationPrefsForm.vue'
import QuestLog from '~/features/notifications/QuestLog.vue'

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
useHead({ title: () => t('notifications.title') })
const { me } = await useMe()
if (!me.value) await navigateTo({ path: localePath('/signin'), query: { redirect: route.fullPath } })
</script>

<template>
  <div v-if="me" class="notifications">
    <QuestLog class="log" />
    <NotificationPrefsForm class="side" />
  </div>
</template>

<style scoped>
.notifications {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
  align-items: flex-start;
}

.log {
  flex: 999 1 40rem;
  min-width: 0;
}

.side {
  flex: 1 1 20rem;
}
</style>
