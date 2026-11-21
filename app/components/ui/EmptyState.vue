<script setup lang="ts">
// Empty state (07-design.md § États vides): never an empty block nor a "0", always a message and, when possible, an
// action. Texts come from the caller (i18n).
withDefaults(defineProps<{ title: string; description?: string; headingLevel?: 1 | 2 | 3 | 4 }>(), {
  description: undefined,
  headingLevel: 2,
})
</script>

<template>
  <div class="empty">
    <div v-if="$slots.icon" class="icon" aria-hidden="true"><slot name="icon" /></div>
    <component :is="`h${headingLevel}`" class="title">{{ title }}</component>
    <p v-if="description" class="description">{{ description }}</p>
    <div v-if="$slots.action" class="action"><slot name="action" /></div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-8) var(--space-4);
  text-align: center;
}

.title {
  font-size: var(--text-2xl);
}

.description {
  max-width: 40ch;
  color: var(--color-text-muted);
}

.action {
  margin-top: var(--space-2);
}
</style>
