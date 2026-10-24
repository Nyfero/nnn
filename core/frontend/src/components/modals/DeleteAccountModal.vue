<template>
  <BaseModal @close="$emit('close')">
    <template #header>
      <div class="modal-header-empty" />
      <div class="modal-header-title"><h2 class="themed-h2">Supprimer le compte</h2></div>
      <div class="modal-header-actions">
        <button class="modal-close" @click="$emit('close')" tabindex="-1">
          <span class="material-icons">close</span>
        </button>
      </div>
    </template>

    <form class="modal-form" @submit.prevent="handleSubmit">
      <div class="delete-warning">
        <span class="material-icons warning-icon">warning</span>
        <p class="themed-label">
          Cette action est <strong>irréversible</strong>. Toutes vos données, dans tous les modules,
          seront définitivement supprimées.
        </p>
      </div>

      <div class="themed-separator" />

      <div class="form-group">
        <label class="themed-label">Mot de passe</label>
        <div class="form-wrapper">
          <input class="themed-input" v-model="form.password" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" required />
          <div class="input-actions">
            <button class="toggle-password" type="button" tabindex="-1" @click="showPassword = !showPassword">
              <span class="material-icons">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="themed-label">Confirmer le mot de passe</label>
        <input
          class="themed-input"
          :class="{ 'input-error': form.confirmPassword && !passwordsMatch }"
          v-model="form.confirmPassword"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          required
        />
        <span v-if="form.confirmPassword && !passwordsMatch" class="field-error">
          Les mots de passe ne correspondent pas
        </span>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>
      <button type="submit" hidden />
    </form>

    <template #footer>
      <div class="modal-footer-left"></div>
      <div class="modal-footer-right">
        <button class="themed-button button-secondary" @click="$emit('close')">Annuler</button>
        <button class="themed-button button-danger" :disabled="!isFormValid || loading" @click="handleSubmit">
          {{ loading ? 'Suppression...' : 'Supprimer définitivement' }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, computed } from 'vue'
import { BaseModal } from '@myprout/ui'

defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['close', 'submit'])

const form = ref({ password: '', confirmPassword: '' })
const showPassword = ref(false)

const passwordsMatch = computed(() => form.value.password === form.value.confirmPassword)
const isFormValid = computed(() => form.value.password && passwordsMatch.value)

function handleSubmit() {
  if (isFormValid.value) emit('submit', form.value.password)
}
</script>

<style scoped>
.delete-warning {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 8px;
  background-color: color-mix(in srgb, var(--mp-danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--mp-danger) 30%, transparent);
}
.warning-icon { color: var(--mp-danger); font-size: 24px; flex-shrink: 0; }
.field-error { font-size: 0.78rem; color: #ff5555; }
.input-error { border-color: #ff5555 !important; }
</style>
