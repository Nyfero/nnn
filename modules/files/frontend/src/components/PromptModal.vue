<template>
  <BaseModal @close="$emit('close')">
    <template #header>
      <div class="modal-header-empty" />
      <div class="modal-header-title"><h2 class="themed-h2">{{ title }}</h2></div>
      <div class="modal-header-actions">
        <button class="modal-close" @click="$emit('close')" tabindex="-1">
          <span class="material-icons">close</span>
        </button>
      </div>
    </template>

    <form class="modal-form" @submit.prevent="submit">
      <p v-if="hint" class="hint">{{ hint }}</p>
      <div class="form-group">
        <label class="themed-label">{{ label }}</label>
        <input ref="input" class="themed-input" v-model="value" type="text" maxlength="255" required />
      </div>
      <p v-if="error" class="form-error">{{ error }}</p>
      <button type="submit" hidden />
    </form>

    <template #footer>
      <div class="modal-footer-left"></div>
      <div class="modal-footer-right">
        <button class="themed-button button-secondary" @click="$emit('close')">Annuler</button>
        <button class="themed-button button-primary" :disabled="!value.trim() || loading" @click="submit">
          {{ loading ? 'En cours...' : confirmText }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { nextTick, onMounted, ref } from 'vue'
import { BaseModal } from '@myprout/ui'

const props = defineProps({
  title: String,
  label: String,
  hint: { type: String, default: '' },
  initial: { type: String, default: '' },
  confirmText: { type: String, default: 'Valider' },
  loading: Boolean,
  error: { type: String, default: '' },
})
const emit = defineEmits(['close', 'submit'])

const value = ref(props.initial)
const input = ref(null)

onMounted(async () => {
  await nextTick()
  input.value?.focus()
  // sélectionne le nom sans l'extension pour un renommage rapide
  const dot = props.initial.lastIndexOf('.')
  input.value?.setSelectionRange(0, dot > 0 ? dot : props.initial.length)
})

function submit() {
  if (value.value.trim()) emit('submit', value.value.trim())
}
</script>

<style scoped>
.hint { font-size: 0.85rem; color: var(--mp-muted); margin: 0 0 0.5rem; line-height: 1.4; }
</style>
