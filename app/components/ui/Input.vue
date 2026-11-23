<script setup lang="ts">
// Form field (SignIn and Upload mockups): visible label always tied to the field, hint and error announced.
// Other attributes (autocomplete, maxlength, placeholder, rows…) go to the field; `multiline`: a text area (bio). Slot `action`: a link beside the label.
defineOptions({ inheritAttrs: false })
const props = defineProps<{
  label: string
  hint?: string
  error?: string
  required?: boolean
  type?: string
  multiline?: boolean
}>()
const model = defineModel<string>({ default: '' })
const id = useId()
const describedBy = computed(
  () => [props.hint && `${id}-hint`, props.error && `${id}-error`].filter(Boolean).join(' ') || undefined,
)
</script>

<template>
  <div class="field">
    <div class="label-row">
      <label :for="id" class="label">
        {{ label }}<span v-if="required" class="required" aria-hidden="true"> *</span>
      </label>
      <slot name="action" />
    </div>
    <textarea
      v-if="multiline"
      :id="id"
      v-model="model"
      v-bind="$attrs"
      :required="required"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      class="input multiline"
      :class="{ invalid: error }"
    ></textarea>
    <input
      v-else
      :id="id"
      v-model="model"
      v-bind="$attrs"
      :type="type ?? 'text'"
      :required="required"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="describedBy"
      class="input"
      :class="{ invalid: error }"
    />
    <p v-if="hint" :id="`${id}-hint`" class="hint">{{ hint }}</p>
    <p v-if="error" :id="`${id}-error`" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1-5);
}

.label-row {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-2);
  font-size: var(--text-sm);
}

.label {
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.required {
  color: var(--color-accent);
}

.input {
  min-height: var(--control-md);
  padding: 0 var(--space-3);
  border: var(--border-width) solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-raised);
  color: var(--color-text);
}

.multiline {
  padding: var(--space-2) var(--space-3);
  resize: vertical;
}

.input:focus-visible {
  border-color: var(--color-accent);
}

.invalid {
  border-color: var(--color-danger);
}

.hint {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.error {
  color: var(--color-danger);
  font-size: var(--text-sm);
}
</style>
