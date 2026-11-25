<script setup lang="ts">
// « My captures » (US-14.4), no mockup: design system only. Every capture of the member once uploaded, with its
// status in words (never a colour alone, US-75.5). A capture that has display variants shows them, through the
// private preview until it is published; one without (processing, failed, rejected) shows a frame of its size.
import type { MyPhotosResponse } from '~~/shared/contracts/photos'
import { api, errorMessageKey } from '~/services/api'

type Capture = MyPhotosResponse['items'][number]
const props = defineProps<{ username: string }>()
const { t } = useI18n()
const localePath = useLocalePath()
const captures = ref<Capture[]>()
const next = ref<string | null>(null)
const loading = ref(false)
const error = ref<string>()

async function load(cursor?: string) {
  loading.value = true
  error.value = undefined
  try {
    const page = await api.myPhotos(cursor)
    captures.value = [...(captures.value ?? []), ...page.items]
    next.value = page.nextCursor
  } catch (thrown) {
    error.value = t(errorMessageKey(thrown))
  } finally {
    loading.value = false
  }
}
onMounted(() => load())

// Deletion after a confirmation (US-12.2): the capture leaves the list
const removing = ref<Capture>()
const deleting = ref(false)
const deleted = ref(false)
async function remove() {
  if (!removing.value) return
  deleting.value = true
  error.value = undefined
  try {
    await api.deletePhoto(removing.value.id)
    captures.value = captures.value?.filter((c) => c.id !== removing.value?.id)
    deleted.value = true
  } catch (thrown) {
    error.value = t(errorMessageKey(thrown))
  } finally {
    deleting.value = false
    removing.value = undefined
  }
}

const WITH_IMAGES = ['published', 'pending_review', 'hidden']
// US-75.3: the zone joins the text when captures get one (T-26a)
const alt = (c: Capture) => t('captures.alt', { title: c.title ?? t('captures.untitled'), author: props.username })
</script>

<template>
  <section class="my-captures" aria-labelledby="my-captures-title">
    <h1 id="my-captures-title" class="title">{{ t('captures.title') }}</h1>
    <ul v-if="captures?.length" class="grid">
      <li v-for="c in captures" :key="c.id" class="card">
        <UiWowImage
          v-if="WITH_IMAGES.includes(c.status)"
          :photo-id="c.id"
          :alt="alt(c)"
          :width="c.width"
          :height="c.height"
          :preview="c.status !== 'published'"
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        />
        <div v-else class="frame" :style="{ aspectRatio: `${c.width} / ${c.height}` }" aria-hidden="true"></div>
        <div class="caption">
          <p class="name">{{ c.title ?? t('captures.untitled') }}</p>
          <p class="status" :class="c.status">{{ t(`captures.status.${c.status}`) }}</p>
          <p v-if="c.status !== 'published'" class="hint">{{ t(`captures.hint.${c.status}`) }}</p>
          <!-- A capture still processing can be neither edited nor deleted yet (US-12) -->
          <div v-if="c.status !== 'processing'" class="actions">
            <UiButton
              :to="localePath(`/my-captures/${c.id}`)"
              variant="ghost"
              :aria-label="t('captures.edit.label', { title: c.title ?? t('captures.untitled') })"
            >
              {{ t('captures.edit.action') }}
            </UiButton>
            <UiButton
              variant="ghost"
              :aria-label="t('captures.delete.label', { title: c.title ?? t('captures.untitled') })"
              @click="removing = c"
            >
              {{ t('captures.delete.action') }}
            </UiButton>
          </div>
        </div>
      </li>
    </ul>
    <UiModal
      :open="Boolean(removing)"
      :title="t('captures.delete.title')"
      :close-label="t('captures.delete.cancel')"
      @update:open="(open: boolean) => !open && (removing = undefined)"
    >
      <p class="confirm">{{ t('captures.delete.confirm', { title: removing?.title ?? t('captures.untitled') }) }}</p>
      <div class="actions">
        <UiButton :disabled="deleting" @click="remove">{{ t('captures.delete.yes') }}</UiButton>
        <UiButton variant="secondary" @click="removing = undefined">{{ t('captures.delete.cancel') }}</UiButton>
      </div>
    </UiModal>
    <p v-if="deleted" class="deleted" role="status">{{ t('captures.delete.done') }}</p>
    <UiEmptyState
      v-else-if="captures"
      :title="t('captures.empty')"
      :description="t('captures.emptyText')"
      :heading-level="2"
    >
      <template #action>
        <UiButton :to="localePath('/upload')">{{ t('layout.upload') }}</UiButton>
      </template>
    </UiEmptyState>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <UiButton v-if="next" variant="secondary" :disabled="loading" class="more" @click="load(next)">
      {{ t('captures.loadMore') }}
    </UiButton>
  </section>
</template>

<style scoped>
.my-captures {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (width >= 640px) {
  .grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (width >= 1024px) {
  .grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.card {
  overflow: hidden;
  border: var(--border-width) solid var(--color-border-subtle);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.frame {
  background: var(--color-surface-raised);
}

.caption {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-3) var(--space-3);
}

.name,
.status,
.hint {
  margin: 0;
}

.name {
  overflow: hidden;
  font-weight: var(--weight-semibold);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status {
  color: var(--color-text-soft);
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.status.published {
  color: var(--color-success);
}

.status.rejected,
.status.failed {
  color: var(--color-danger);
}

.hint {
  color: var(--color-text-faint);
  font-size: var(--text-xs);
}

.error {
  margin: 0;
  color: var(--color-danger);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.confirm,
.deleted {
  margin: 0;
}

.deleted {
  color: var(--color-text-soft);
}

.more {
  align-self: center;
}
</style>
