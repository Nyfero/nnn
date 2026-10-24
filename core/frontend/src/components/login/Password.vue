<template>
  <div class="themed-card login-card">
    <transition name="fade" mode="out-in">
      <div :key="step">
        <template v-if="step === 'form'">
          <div class="login-header">
            <h2 class="themed-h2">
              {{ mode === 'reset' ? 'Nouveau mot de passe' : 'Définir votre mot de passe' }}
            </h2>
          </div>

          <div class="login-body">
            <form @submit.prevent="handleSubmit">
              <div class="form-wrapper">
                <input
                  class="themed-input"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Mot de passe"
                  autocomplete="new-password"
                  required
                />
                <div class="input-actions">
                  <button class="toggle-password" type="button" @click="showPassword = !showPassword">
                    <span class="material-icons">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
                  </button>
                </div>
              </div>

              <PasswordCriteria :password="password" />

              <div class="form-wrapper">
                <input
                  class="themed-input"
                  v-model="confirmPassword"
                  :type="showConfirm ? 'text' : 'password'"
                  placeholder="Confirmer le mot de passe"
                  autocomplete="new-password"
                  required
                />
                <div class="input-actions">
                  <button class="toggle-password" type="button" @click="showConfirm = !showConfirm">
                    <span class="material-icons">{{ showConfirm ? 'visibility_off' : 'visibility' }}</span>
                  </button>
                </div>
              </div>

              <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>

              <div class="login-footer">
                <button class="themed-button button-primary" type="submit" :disabled="isLoading">
                  {{ isLoading ? 'En cours...' : 'Continuer' }}
                </button>
              </div>
            </form>
          </div>
        </template>

        <template v-else-if="step === 'done'">
          <div class="login-header">
            <svg class="svg" viewBox="0 0 52 52" stroke="#4bb543">
              <circle class="svg-circle" cx="26" cy="26" r="25" fill="none" />
              <path class="svg-check" fill="none" d="M14 27l7 7 16-16" />
            </svg>
            <h2 class="themed-h2">Mot de passe réinitialisé avec succès !</h2>
          </div>
          <div class="login-body">
            <p>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
          </div>
          <div class="login-footer">
            <button class="themed-button button-secondary" @click="$emit('switch')">Se connecter</button>
          </div>
        </template>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { wrapMasterKey } from '@myprout/sdk/client'
import PasswordCriteria from '@/components/shared/PasswordCriteria.vue'
import { ENFORCE_PASSWORD_CRITERIA, meetsCriteria } from '@/utils/passwordCriteria'
import api from '@/services/api'

const props = defineProps({
  token: String,
  mode: { type: String, default: 'set' }, // 'set' | 'reset'
  masterKey: String, // reset : clé maître (hex) retrouvée via les questions de sécurité
})
const emit = defineEmits(['switch', 'next'])

const step = ref('form')
const password = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const showConfirm = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')

onMounted(() => {
  if (!props.token) errorMessage.value = 'Token manquant ou invalide'
})

async function handleSubmit() {
  errorMessage.value = ''

  if (ENFORCE_PASSWORD_CRITERIA && !meetsCriteria(password.value)) {
    errorMessage.value = 'Le mot de passe ne respecte pas les critères'
    return
  }
  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Les mots de passe ne correspondent pas'
    return
  }

  if (props.mode === 'set') {
    emit('next', { token: props.token, password: password.value })
    return
  }

  // Reset : la clé maître est rechiffrée côté client avec le nouveau mot de passe
  isLoading.value = true
  try {
    const blob = await wrapMasterKey(props.masterKey, password.value)
    await api.put('/auth/password/reset', {
      token: props.token,
      password: password.value,
      ...blob,
    })
    step.value = 'done'
  } catch (error) {
    errorMessage.value = error.response?.data?.error ?? 'Une erreur est survenue'
  } finally {
    isLoading.value = false
  }
}
</script>
