<template>
  <BaseModal @close="$emit('close')">
    <template #header>
      <div class="modal-header-empty" />
      <div class="modal-header-title"><h2 class="themed-h2">Modifier le mot de passe</h2></div>
      <div class="modal-header-actions">
        <button class="modal-close" @click="$emit('close')" tabindex="-1">
          <span class="material-icons">close</span>
        </button>
      </div>
    </template>

    <form class="modal-form" @submit.prevent="handleSubmit">
      <div class="form-group">
        <label class="themed-label">Ancien mot de passe</label>
        <div class="form-wrapper">
          <input class="themed-input" v-model="form.oldPassword" :type="showOld ? 'text' : 'password'" autocomplete="current-password" required />
          <div class="input-actions">
            <button class="toggle-password" type="button" tabindex="-1" @click="showOld = !showOld">
              <span class="material-icons">{{ showOld ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="themed-separator" />

      <div class="form-group">
        <label class="themed-label">Nouveau mot de passe</label>
        <div class="form-wrapper">
          <input class="themed-input" v-model="form.newPassword" :type="showNew ? 'text' : 'password'" autocomplete="new-password" required />
          <div class="input-actions">
            <button class="toggle-password" type="button" tabindex="-1" @click="showNew = !showNew">
              <span class="material-icons">{{ showNew ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="form-group">
        <label class="themed-label">Confirmer le nouveau mot de passe</label>
        <div class="form-wrapper">
          <input
            class="themed-input"
            :class="{ 'input-error': form.confirmPassword && !passwordsMatch }"
            v-model="form.confirmPassword"
            :type="showConfirm ? 'text' : 'password'"
            autocomplete="new-password"
            required
          />
          <div class="input-actions">
            <button class="toggle-password" type="button" tabindex="-1" @click="showConfirm = !showConfirm">
              <span class="material-icons">{{ showConfirm ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
        </div>
        <PasswordCriteria :password="form.newPassword" />
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
        <button class="themed-button button-primary" :disabled="!isFormValid || loading" @click="handleSubmit">
          {{ loading ? 'Enregistrement...' : 'Confirmer' }}
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, computed } from 'vue'
import { BaseModal } from '@myprout/ui'
import PasswordCriteria from '@/components/shared/PasswordCriteria.vue'
import { ENFORCE_PASSWORD_CRITERIA, meetsCriteria } from '@/utils/passwordCriteria'

defineProps({
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})
const emit = defineEmits(['close', 'submit'])

const form = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })
const showOld = ref(false)
const showNew = ref(false)
const showConfirm = ref(false)

const passwordsMatch = computed(() => form.value.newPassword === form.value.confirmPassword)
const isFormValid = computed(
  () =>
    form.value.oldPassword &&
    form.value.newPassword &&
    passwordsMatch.value &&
    (!ENFORCE_PASSWORD_CRITERIA || meetsCriteria(form.value.newPassword))
)

function handleSubmit() {
  if (!isFormValid.value) return
  emit('submit', { oldPassword: form.value.oldPassword, newPassword: form.value.newPassword })
}
</script>

<style scoped>
.field-error { font-size: 0.78rem; color: #ff5555; margin-top: 2px; }
.input-error { border-color: #ff5555 !important; }
</style>
