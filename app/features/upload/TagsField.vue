<script setup lang="ts">
// Tags of the upload form (Upload mockup, US-11.1): typed then added with Enter or a comma, suggested from the
// existing tags (native list), 10 at most, normalised as the server stores them; each removable.
import { TAGS_PER_PHOTO, validateTag } from '~~/shared/domain/tags'
import { api } from '~/services/api'

const tags = defineModel<string[]>({ default: () => [] })
const props = defineProps<{ error?: string }>()
const { t } = useI18n()
const id = useId()
const draft = ref('')
const suggestions = ref<string[]>([])
const problem = ref<string>()
let timer: ReturnType<typeof setTimeout> | undefined

watch(draft, (text) => {
  clearTimeout(timer)
  if (text.trim().length < 2) return void (suggestions.value = [])
  timer = setTimeout(async () => {
    suggestions.value = (await api.suggestTags(text).catch(() => ({ tags: [] }))).tags
  }, 200)
})

function add() {
  const raw = draft.value.replace(/,$/, '')
  if (!raw.trim()) return
  const tag = validateTag(raw)
  if (!tag.ok) return void (problem.value = t(`upload.tags.${tag.error}`))
  if (tags.value.length >= TAGS_PER_PHOTO) return void (problem.value = t('upload.tags.too_many'))
  if (!tags.value.includes(tag.value)) tags.value = [...tags.value, tag.value]
  draft.value = ''
  problem.value = undefined
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault()
    add()
  }
}
const shown = computed(() => problem.value ?? props.error)
</script>

<template>
  <div class="tags">
    <label :for="id" class="label"
      >{{ t('upload.tags.label') }} <span class="hint">· {{ t('upload.tags.max') }}</span></label
    >
    <div class="box" :class="{ invalid: shown }">
      <span v-for="tag in tags" :key="tag" class="chip">
        #{{ tag }}
        <button
          type="button"
          class="remove"
          :aria-label="t('upload.tags.remove', { tag })"
          @click="tags = tags.filter((other) => other !== tag)"
        >
          ×
        </button>
      </span>
      <input
        :id="id"
        v-model="draft"
        class="input"
        :list="`${id}-list`"
        :placeholder="t('upload.tags.placeholder')"
        :aria-describedby="shown ? `${id}-error` : undefined"
        :aria-invalid="shown ? 'true' : undefined"
        autocomplete="off"
        maxlength="64"
        @keydown="onKey"
        @blur="add"
      />
      <datalist :id="`${id}-list`">
        <option v-for="suggestion in suggestions" :key="suggestion" :value="suggestion"></option>
      </datalist>
    </div>
    <p v-if="shown" :id="`${id}-error`" class="error">{{ shown }}</p>
  </div>
</template>

<style scoped>
.tags {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
}

.label {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.hint {
  color: var(--color-text-muted);
  font-weight: var(--weight-regular);
}

.box {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1-5);
  align-items: center;
  min-height: var(--control-md);
  padding: var(--space-1-5) var(--space-2);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
}

.box:focus-within {
  box-shadow: var(--focus-ring);
}

.box.invalid {
  border-color: var(--color-danger);
}

.chip {
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  padding: var(--space-0-5) var(--space-1) var(--space-0-5) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--color-surface-hover);
  font-size: var(--text-sm);
}

.remove {
  min-width: var(--control-md);
  min-height: var(--control-md);
  border: 0;
  background: transparent;
  color: var(--color-text-soft);
  cursor: pointer;
}

.input {
  flex: 1;
  min-width: 8rem;
  height: var(--control-sm);
  border: 0;
  outline: none;
  background: transparent;
}

.input:focus-visible {
  box-shadow: none;
}

.error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}
</style>
