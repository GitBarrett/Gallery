<script setup lang="ts">
// Quest banner of the home (US-24.3, Main mockup): an open contest, announced with a call to take part. Shown only with
// `features.contests` and a contest given; the contests come with T-64, so the home gives none until then.
defineProps<{ enabled: boolean; contest: { title: string; text: string; slug: string } | null }>()
const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <aside v-if="enabled && contest" class="quest" :aria-label="t('home.quest.label')">
    <p class="text">
      <strong>{{ t('home.quest.new', { title: contest.title }) }}</strong>
      {{ contest.text }}
    </p>
    <UiButton :to="localePath(`/contests/${contest.slug}`)" variant="secondary">{{ t('home.quest.accept') }}</UiButton>
  </aside>
</template>

<style scoped>
.quest {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  padding: var(--space-3) var(--space-4);
  border: var(--border-width) solid var(--color-accent);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.text {
  margin: 0;
}
</style>
