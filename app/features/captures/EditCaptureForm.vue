<script setup lang="ts">
// Edit of one's capture (US-12.1, US-13.1), no mockup: the fields of the upload form, filled with the capture's
// details; saving sends them all (an emptied field is cleared). No new image moderation: the status stays.
import type { MyPhotoResponse, UpdatePhotoBody } from '~~/shared/contracts/photos'
import { api, ApiError, errorMessageKey } from '~/services/api'
import FocalPicker from '~/features/upload/FocalPicker.vue'
import TagsField from '~/features/upload/TagsField.vue'
import { useZoneSuggestions } from '~/features/upload/useZoneSuggestions'

const props = defineProps<{ photoId: string }>()
const { t } = useI18n()
const localePath = useLocalePath()
const capture = ref<MyPhotoResponse>()
const form = reactive({
  title: '',
  zone: '',
  inGameTime: '',
  graphicsSettings: '',
  characterName: '',
  caption: '',
  description: '',
  altText: '',
  tags: [] as string[],
  focal: null as { x: number; y: number } | null,
})
const known = computed(() => (capture.value?.zone ? [capture.value.zone] : []))
const { zones, nameOf, read } = useZoneSuggestions(toRef(form, 'zone'), known)
const errors = ref<Record<string, string>>({})
const error = ref<string>()
const saving = ref(false)
const saved = ref(false)

onMounted(async () => {
  try {
    const found = await api.myPhoto(props.photoId)
    capture.value = found
    Object.assign(form, {
      title: found.title ?? '',
      zone: found.zone ? nameOf(found.zone) : (found.zoneCustom ?? ''),
      inGameTime: found.inGameTime ?? '',
      graphicsSettings: found.graphicsSettings ?? '',
      characterName: found.characterName ?? '',
      caption: found.caption ?? '',
      description: found.description ?? '',
      altText: found.altText ?? '',
      tags: found.tags,
      focal: found.focalX === null || found.focalY === null ? null : { x: found.focalX, y: found.focalY },
    })
  } catch (thrown) {
    error.value = t(errorMessageKey(thrown))
  }
})

// Images exist for these statuses only (T-25b); the others have nothing to point at
const image = computed(() => {
  const status = capture.value?.status
  if (!status || !['published', 'pending_review', 'hidden'].includes(status)) return undefined
  return `/img/${props.photoId}/1200${status === 'published' ? '' : '?preview=1'}`
})

function body(): UpdatePhotoBody {
  const zone = read()
  return {
    title: form.title,
    ...(zone.zone ? { zone: zone.zone } : zone.zoneCustom ? { zoneCustom: zone.zoneCustom } : { zone: null }),
    inGameTime: form.inGameTime,
    graphicsSettings: form.graphicsSettings,
    characterName: form.characterName,
    caption: form.caption,
    description: form.description,
    altText: form.altText,
    tags: form.tags,
    focalX: form.focal?.x ?? null,
    focalY: form.focal?.y ?? null,
  }
}

async function save() {
  saving.value = true
  saved.value = false
  errors.value = {}
  error.value = undefined
  try {
    await api.updatePhoto(props.photoId, body())
    saved.value = true
  } catch (thrown) {
    const details = thrown instanceof ApiError ? thrown.details : undefined
    if (details?.field && details.reason)
      errors.value = { [details.field]: t(`upload.errors.${details.reason}`, t('upload.errors.invalid')) }
    else error.value = t(errorMessageKey(thrown))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="edit" aria-labelledby="edit-title">
    <h1 id="edit-title" class="title">{{ t('captures.edit.title') }}</h1>
    <form v-if="capture" class="form" novalidate @submit.prevent="save">
      <FocalPicker v-if="image" v-model="form.focal" :src="image" />
      <UiInput v-model="form.title" :label="t('upload.fields.title')" required maxlength="100" :error="errors.title" />
      <div class="grid">
        <UiInput
          v-model="form.zone"
          :label="t('upload.fields.zone')"
          :hint="t('upload.fields.zoneHint')"
          list="edit-zones"
          autocomplete="off"
          maxlength="100"
          :error="errors.zone ?? errors.zoneCustom"
        />
        <datalist id="edit-zones">
          <option v-for="z in zones" :key="z.slug" :value="nameOf(z)"></option>
        </datalist>
        <UiInput v-model="form.inGameTime" :label="t('upload.fields.time')" type="time" :error="errors.inGameTime" />
        <UiInput
          v-model="form.graphicsSettings"
          :label="t('upload.fields.graphics')"
          maxlength="100"
          :error="errors.graphicsSettings"
        />
        <UiInput
          v-model="form.characterName"
          :label="t('upload.fields.character')"
          maxlength="100"
          :error="errors.characterName"
        />
      </div>
      <UiInput v-model="form.caption" :label="t('upload.fields.caption')" maxlength="140" :error="errors.caption" />
      <UiInput
        v-model="form.description"
        :label="t('upload.fields.description')"
        multiline
        rows="3"
        maxlength="1000"
        :error="errors.description"
      />
      <UiInput v-model="form.altText" :label="t('upload.fields.alt')" maxlength="150" :error="errors.altText" />
      <TagsField v-model="form.tags" :error="errors.tags" />
      <p v-if="saved" class="saved" role="status">{{ t('captures.edit.saved') }}</p>
      <div class="actions">
        <UiButton type="submit" size="lg" :disabled="saving || !form.title.trim()">{{
          t('captures.edit.save')
        }}</UiButton>
        <UiButton :to="localePath('/my-captures')" variant="secondary" size="lg">{{
          t('captures.edit.back')
        }}</UiButton>
      </div>
    </form>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.edit,
.form {
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
  gap: var(--space-4);
}

@media (width >= 768px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.saved,
.error {
  margin: 0;
}

.saved {
  color: var(--color-success);
}

.error {
  color: var(--color-danger);
}
</style>
