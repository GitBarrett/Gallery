<script setup lang="ts">
// Champ de formulaire (maquettes SignIn et Upload) : libellé visible toujours relié, aide et erreur annoncées.
// Les autres attributs (autocomplete, maxlength, placeholder…) passent au champ.
defineOptions({ inheritAttrs: false })
const props = defineProps<{ label: string; hint?: string; error?: string; required?: boolean; type?: string }>()
const model = defineModel<string>({ default: '' })
const id = useId()
const describedBy = computed(
  () => [props.hint && `${id}-hint`, props.error && `${id}-error`].filter(Boolean).join(' ') || undefined,
)
</script>

<template>
  <div class="field">
    <label :for="id" class="label">
      {{ label }}<span v-if="required" class="required" aria-hidden="true"> *</span>
    </label>
    <input
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
