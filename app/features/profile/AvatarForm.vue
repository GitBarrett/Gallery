<script setup lang="ts">
// Avatar in the settings (US-07.6): the member picks an image, sees its centred square (cut in the browser), then
// sends it: presigned PUT, then moderation on the server. The avatar shown stays until the new one is approved; the
// member is notified of the outcome.
import { MIN_AVATAR_SIDE } from '~~/shared/domain/avatar-file'
import { api, errorMessageKey } from '~/services/api'
import { put } from '~/features/upload/useUpload'
import { cropSquare } from './crop-square'

defineProps<{ avatarUrl: string | null; username: string }>()

const { t } = useI18n()
const cropped = ref<{ file: File; side: number; preview: string }>()
const error = ref<string>()
const sending = ref(false)
const sent = ref(false)

function forget() {
  if (cropped.value) URL.revokeObjectURL(cropped.value.preview)
  cropped.value = undefined
}
onBeforeUnmount(forget)

async function choose(event: Event) {
  const input = event.target as HTMLInputElement
  const chosen = input.files?.[0]
  input.value = '' // the same file can be chosen again
  if (!chosen) return
  forget()
  sent.value = false
  error.value = undefined
  const square = await cropSquare(chosen)
  if (!square) error.value = t('settings.avatar.unreadable')
  else if (square.side < MIN_AVATAR_SIDE) error.value = t('settings.avatar.small', { min: MIN_AVATAR_SIDE })
  else cropped.value = { ...square, preview: URL.createObjectURL(square.file) }
}

async function send() {
  if (!cropped.value) return
  const { file, side } = cropped.value
  sending.value = true
  error.value = undefined
  try {
    const asked = await api.avatarUploadUrl({ contentType: file.type, bytes: file.size, width: side, height: side })
    const status = await put(asked.url, file, () => {})
    if (status < 200 || status >= 300) {
      error.value = t('settings.avatar.failed')
      return
    }
    await api.completeAvatar(asked.version)
    forget()
    sent.value = true
  } catch (thrown) {
    error.value = t(errorMessageKey(thrown))
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <section class="avatar-form" aria-labelledby="avatar-form-title">
    <h2 id="avatar-form-title" class="title">{{ t('settings.avatar.title') }}</h2>
    <div class="row">
      <img v-if="cropped" :src="cropped.preview" :alt="t('settings.avatar.preview')" class="preview" />
      <UiAvatar v-else :src="avatarUrl" :name="username" size="lg" />
      <div class="actions">
        <label class="file-label">
          <span class="file-button">{{ t('settings.avatar.choose') }}</span>
          <input
            type="file"
            class="visually-hidden"
            accept="image/jpeg,image/png,image/webp"
            :disabled="sending"
            @change="choose"
          />
        </label>
        <p class="hint">{{ t('settings.avatar.hint') }}</p>
        <UiButton v-if="cropped" :disabled="sending" @click="send">{{ t('settings.avatar.submit') }}</UiButton>
      </div>
    </div>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <p v-if="sent" class="sent" role="status">{{ t('settings.avatar.sent') }}</p>
  </section>
</template>

<style scoped>
.avatar-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.title {
  margin: 0;
  font-family: var(--font-display);
  font-size: var(--text-xl);
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  align-items: center;
}

.preview {
  width: 112px;
  height: 112px;
  border: 3px solid var(--color-accent);
  border-radius: var(--radius-md);
}

.actions {
  display: flex;
  flex: 1 1 200px;
  flex-direction: column;
  gap: var(--space-2);
  align-items: flex-start;
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

.hint,
.error,
.sent {
  margin: 0;
}

.hint {
  color: var(--color-text-faint);
  font-size: var(--text-sm);
}

.error {
  color: var(--color-danger);
}

.sent {
  color: var(--color-text-soft);
}
</style>
