<script setup lang="ts">
// Upload form (Upload mockup, US-10, US-11): the file checked in the browser by the shared rules (US-10.2), the
// details, the consent, then the upload with its progress. A TGA or a PNG over 20 MB is converted first (T-26b,
// US-10.9). Zone and tags are suggested by native lists: a zone typed but not chosen is sent as a free zone (US-11.3).
import type { GameVersionsResponse } from '~~/shared/contracts/catalog'
import type { CompleteUploadBody } from '~~/shared/contracts/photos'
import { api, ApiError, errorMessageKey } from '~/services/api'
import FocalPicker from './FocalPicker.vue'
import TagsField from './TagsField.vue'
import UploadPreview from './UploadPreview.vue'
import { inspectFile, useUpload, type ChosenFile, type FileProblem } from './useUpload'
import { useZoneSuggestions } from './useZoneSuggestions'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const online = useOnline()
const { progress, send } = useUpload()

const chosen = ref<ChosenFile>()
const fileProblem = ref<FileProblem>()
const converting = ref(false)
const versions = ref<GameVersionsResponse['versions']>([])
const form = reactive({
  title: '',
  gameVersion: '',
  zone: '',
  inGameTime: '',
  graphicsSettings: '',
  characterName: '',
  caption: '',
  description: '',
  altText: '',
  tags: [] as string[],
  focal: null as { x: number; y: number } | null,
  consent: false,
})
const errors = ref<Record<string, string>>({})
const formError = ref<string>()
const sending = ref(false)
const sent = ref(false)

const nameOf = (item: { nameEn: string; nameFr: string }) => (locale.value === 'fr' ? item.nameFr : item.nameEn)
onMounted(async () => {
  versions.value = (await api.gameVersions().catch(() => ({ versions: [] }))).versions
})

const { zones, read: zoneFields } = useZoneSuggestions(toRef(form, 'zone'))

async function choose(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (chosen.value) URL.revokeObjectURL(chosen.value.preview)
  chosen.value = fileProblem.value = undefined
  form.focal = null
  const inspected = await inspectFile(file, () => (converting.value = true))
  converting.value = false
  chosen.value = inspected.ok ? inspected.value : undefined
  fileProblem.value = inspected.ok ? undefined : inspected.error
}

const optional = (text: string) => text.trim() || undefined
function body(): CompleteUploadBody {
  return {
    title: form.title,
    gameVersion: form.gameVersion,
    ...zoneFields(),
    inGameTime: form.inGameTime || undefined,
    graphicsSettings: optional(form.graphicsSettings),
    characterName: optional(form.characterName),
    caption: optional(form.caption),
    description: optional(form.description),
    altText: optional(form.altText),
    tags: form.tags.length ? form.tags : undefined,
    ...(form.focal && { focalX: form.focal.x, focalY: form.focal.y }),
  }
}

function explain(thrown: unknown) {
  const details = thrown instanceof ApiError ? thrown.details : undefined
  if (thrown instanceof ApiError && thrown.code === 'RATE_LIMITED' && details?.retryAfterSeconds) {
    const at = new Date(Date.now() + details.retryAfterSeconds * 1000)
    return void (formError.value = t('upload.limited', {
      time: at.toLocaleTimeString(locale.value, { timeStyle: 'short' }),
    }))
  }
  if (details?.field && details.field !== 'file' && details.reason) {
    errors.value = { [details.field]: t(`upload.errors.${details.reason}`, t('upload.errors.invalid')) }
    return
  }
  formError.value = t(thrown instanceof ApiError ? errorMessageKey(thrown) : 'upload.failed')
}

async function submit() {
  if (!chosen.value || sending.value) return
  sending.value = true
  errors.value = {}
  formError.value = undefined
  try {
    await send(chosen.value, body())
    sent.value = true
  } catch (thrown) {
    explain(thrown)
  } finally {
    sending.value = false
  }
}

// Two decimals under 1 MB, so that a small file never reads « 0 MB »
const megabytes = (bytes: number) =>
  (bytes / 1_000_000).toLocaleString(locale.value, { maximumFractionDigits: bytes < 1_000_000 ? 2 : 1 })
const versionName = computed(() => versions.value.find((v) => v.slug === form.gameVersion))
const steps = computed(() => [
  { key: 'file', done: Boolean(chosen.value), current: !chosen.value },
  { key: 'details', done: sent.value, current: Boolean(chosen.value) && !sent.value },
  { key: 'review', done: false, current: sent.value },
])
</script>

<template>
  <div class="upload">
    <div class="head">
      <h1 class="title">{{ t('upload.title') }}</h1>
      <ol class="steps" :aria-label="t('upload.steps.label')">
        <li
          v-for="(step, i) in steps"
          :key="step.key"
          class="step"
          :class="{ done: step.done, current: step.current }"
          :aria-current="step.current ? 'step' : undefined"
        >
          {{ i + 1 }} · {{ t(`upload.steps.${step.key}`) }}<span v-if="step.done" aria-hidden="true"> ✓</span>
        </li>
      </ol>
    </div>

    <div v-if="sent" class="accepted" role="status">
      <UiQuestMarker kind="question" :label="t('upload.acceptedLabel')" class="marker" />
      <p class="accepted-text">
        <strong>{{ t('upload.accepted') }}</strong> {{ t('upload.acceptedText') }}
        <NuxtLink :to="localePath('/my-captures')">{{ t('captures.title') }}</NuxtLink>
      </p>
    </div>

    <div class="layout">
      <form class="form" novalidate @submit.prevent="submit">
        <section class="section" aria-labelledby="upload-file">
          <h2 id="upload-file" class="section-title">{{ t('upload.file.title') }}</h2>
          <div class="file">
            <img v-if="chosen" :src="chosen.preview" alt="" class="thumbnail" />
            <div class="file-info">
              <label class="file-label">
                <span class="file-button">{{ chosen ? t('upload.file.another') : t('upload.file.choose') }}</span>
                <input
                  type="file"
                  class="visually-hidden"
                  accept="image/jpeg,image/png,image/webp,image/x-tga,.tga"
                  :aria-invalid="fileProblem ? 'true' : undefined"
                  :disabled="converting"
                  @change="choose"
                />
              </label>
              <p v-if="converting" class="muted" role="status">{{ t('upload.file.converting') }}</p>
              <template v-if="chosen">
                <p class="file-name">{{ chosen.file.name }}</p>
                <p v-if="chosen.converted" class="ok">{{ t(`upload.file.converted.${chosen.converted}`) }}</p>
                <p v-if="chosen.converted === 'jpeg'" class="warning" role="alert">{{ t('upload.file.lossy') }}</p>
                <p class="ok">{{ t('upload.file.size', { size: megabytes(chosen.file.size) }) }}</p>
                <p class="ok">{{ t('upload.file.dimensions', { width: chosen.width, height: chosen.height }) }}</p>
                <p class="muted">{{ t('upload.file.metadata') }}</p>
              </template>
              <p v-if="fileProblem" class="error" role="alert">{{ t(`upload.file.problem.${fileProblem}`) }}</p>
            </div>
          </div>
          <p class="muted">{{ t('upload.file.accepted') }}</p>
          <FocalPicker v-if="chosen" v-model="form.focal" :src="chosen.preview" />
        </section>

        <section class="section" aria-labelledby="upload-about">
          <h2 id="upload-about" class="section-title">{{ t('upload.about') }}</h2>
          <UiInput
            v-model="form.title"
            :label="t('upload.fields.title')"
            required
            maxlength="100"
            :error="errors.title"
          />
          <div class="field">
            <label for="upload-version" class="label"
              >{{ t('upload.fields.version') }}<span aria-hidden="true"> *</span></label
            >
            <select
              id="upload-version"
              v-model="form.gameVersion"
              required
              class="select"
              :aria-invalid="errors.gameVersion ? 'true' : undefined"
            >
              <option value="" disabled>{{ t('upload.fields.versionPick') }}</option>
              <option v-for="v in versions" :key="v.slug" :value="v.slug">{{ nameOf(v) }}</option>
            </select>
          </div>
          <div class="grid">
            <UiInput
              v-model="form.zone"
              :label="t('upload.fields.zone')"
              :hint="t('upload.fields.zoneHint')"
              list="upload-zones"
              autocomplete="off"
              maxlength="100"
              :error="errors.zone ?? errors.zoneCustom"
            />
            <datalist id="upload-zones">
              <option v-for="z in zones" :key="z.slug" :value="nameOf(z)"></option>
            </datalist>
            <UiInput
              v-model="form.inGameTime"
              :label="t('upload.fields.time')"
              type="time"
              :error="errors.inGameTime"
            />
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
          <UiInput
            v-model="form.caption"
            :label="t('upload.fields.caption')"
            :hint="t('upload.fields.captionHint')"
            maxlength="140"
            :error="errors.caption"
          />
          <UiInput
            v-model="form.description"
            :label="t('upload.fields.description')"
            multiline
            rows="3"
            maxlength="1000"
            :error="errors.description"
          />
          <UiInput
            v-model="form.altText"
            :label="t('upload.fields.alt')"
            :hint="t('upload.fields.altHint')"
            maxlength="150"
            :error="errors.altText"
          />
          <TagsField v-model="form.tags" :error="errors.tags" />
        </section>

        <label class="consent">
          <input v-model="form.consent" type="checkbox" required class="checkbox" />
          <span>{{ t('upload.consent') }}</span>
        </label>

        <div v-if="sending" class="progress-row">
          <progress class="progress" :value="progress" max="1" :aria-label="t('upload.progress')"></progress>
          <span class="muted">{{ Math.round(progress * 100) }} %</span>
        </div>
        <p v-if="formError" class="error" role="alert">{{ formError }}</p>
        <div class="actions">
          <UiButton
            type="submit"
            size="lg"
            :disabled="!chosen || !form.title.trim() || !form.gameVersion || !form.consent || sending || !online"
            :title="online ? undefined : t('offline.banner')"
          >
            {{ t('upload.publish') }}
          </UiButton>
          <UiButton :to="localePath('/')" variant="secondary" size="lg">{{ t('upload.cancel') }}</UiButton>
        </div>
      </form>

      <UploadPreview
        class="side"
        :thumbnail="chosen?.preview"
        :title="form.title"
        :version="versionName && nameOf(versionName)"
        :zone="form.zone"
        :time="form.inGameTime"
        :width="chosen?.width"
        :height="chosen?.height"
        :caption="form.caption"
        :focal="form.focal"
      />
    </div>
  </div>
</template>

<style scoped>
.upload,
.form,
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-2xl);
}

.steps {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: var(--text-sm);
}

.step {
  padding: var(--space-2) var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-pill);
  color: var(--color-text-muted);
}

.step.done {
  border-color: var(--color-success);
  color: var(--color-success);
}

.step.current {
  border-color: var(--color-accent);
  color: var(--color-accent);
  font-weight: var(--weight-semibold);
}

.accepted {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
}

.marker {
  flex: none;
  width: 1.25rem;
}

.accepted-text {
  margin: 0;
  color: var(--color-text-soft);
}

.layout {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
  align-items: flex-start;
}

.form {
  flex: 999 1 36rem;
  min-width: 0;
}

.side {
  flex: 1 1 20rem;
}

.section-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.file {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  padding: var(--space-3);
  border: var(--border-width) dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}

.thumbnail {
  width: 15rem;
  max-width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius-sm);
  object-fit: cover;
}

.file-info {
  display: flex;
  flex: 1 1 15rem;
  flex-direction: column;
  gap: var(--space-1-5);
  font-size: var(--text-sm);
}

.file-label {
  align-self: flex-start;
}

.file-button {
  display: inline-flex;
  align-items: center;
  min-height: var(--control-md);
  padding: 0 var(--space-4);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
}

.file-label:focus-within .file-button {
  box-shadow: var(--focus-ring);
}

.file-name {
  font-weight: var(--weight-semibold);
}

.file-name,
.ok,
.warning,
.muted,
.error {
  margin: 0;
}

.ok {
  color: var(--color-success);
}

.warning {
  color: var(--color-accent);
}

.muted {
  color: var(--color-text-faint);
  font-size: var(--text-sm);
}

.error {
  color: var(--color-danger);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
}

.label {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.select {
  height: var(--control-md);
  padding: 0 var(--space-2-5);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
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

.consent {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  min-height: var(--control-md);
  color: var(--color-text-soft);
  font-size: var(--text-sm);
  cursor: pointer;
}

.checkbox {
  flex: none;
  width: var(--space-5);
  height: var(--space-5);
  margin: 0;
  accent-color: var(--color-accent);
}

.progress-row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
}

.progress {
  flex: 1;
  accent-color: var(--color-accent);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
</style>
