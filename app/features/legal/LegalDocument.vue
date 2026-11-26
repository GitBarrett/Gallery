<script setup lang="ts">
// A legal page (US-74.1) in the reader's language, English when not translated yet; its first line is the update date.
// Wide tables scroll sideways inside a focusable region so that the page never does (US-67.6).
import { legalDocument, type LegalPage } from './legal'
import LegalText from './LegalText.vue'

const props = defineProps<{ page: LegalPage }>()
const { t, locale } = useI18n()
const doc = computed(() => legalDocument(props.page, locale.value))
usePageHead({
  title: () => doc.value.title,
  description: () => t('legal.description', { title: doc.value.title }),
  path: () => (props.page === 'legal-notice' ? '/legal' : `/${props.page}`), // app/pages/legal.vue
})
</script>

<template>
  <article class="legal" :lang="doc.lang">
    <template v-for="(block, i) in doc.blocks" :key="i">
      <ul v-if="block.kind === 'ul'" class="list">
        <li v-for="(item, j) in block.items" :key="j"><LegalText :content="item" /></li>
      </ul>
      <div v-else-if="block.kind === 'table'" class="scroll" tabindex="0" role="region" :aria-label="t('legal.table')">
        <table class="table">
          <thead>
            <tr>
              <th v-for="(cell, j) in block.head" :key="j" scope="col"><LegalText :content="cell" /></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, j) in block.rows" :key="j">
              <td v-for="(cell, k) in row" :key="k"><LegalText :content="cell" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <component :is="block.kind" v-else :class="block.kind"><LegalText :content="block.content" /></component>
    </template>
  </article>
</template>

<style scoped>
.legal {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  max-width: 72ch;
  color: var(--color-text-soft);
}

.h1 {
  margin-bottom: var(--space-1);
  color: var(--color-text);
  font-size: var(--text-3xl);
}

.h2 {
  margin-top: var(--space-5);
  color: var(--color-text);
  font-size: var(--text-xl);
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding-left: var(--space-5);
}

.legal :deep(strong) {
  color: var(--color-text);
}

.scroll {
  overflow-x: auto;
  border: var(--border-width) solid var(--color-border-subtle);
  border-radius: var(--radius-md);
}

.table {
  min-width: 36rem;
  border-collapse: collapse;
  font-size: var(--text-sm);
}

th,
td {
  padding: var(--space-2) var(--space-3);
  border-bottom: var(--border-width) solid var(--color-border-subtle);
  text-align: left;
  vertical-align: top;
}

th {
  color: var(--color-text);
  background: var(--color-surface);
}

tr:last-child td {
  border-bottom: 0;
}
</style>
