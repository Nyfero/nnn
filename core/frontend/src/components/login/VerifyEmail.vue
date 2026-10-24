<template>
  <div class="themed-card login-card">
    <transition name="fade" mode="out-in">
      <div :key="step">
        <template v-if="step === 'done'">
          <div class="login-header">
            <svg class="svg" viewBox="0 0 52 52" stroke="#4bb543">
              <circle class="svg-circle" cx="26" cy="26" r="25" fill="none" />
              <path class="svg-check" fill="none" d="M14 27l7 7 16-16" />
            </svg>
            <h2 class="themed-h2">Adresse email confirmée !</h2>
          </div>
          <div class="login-body">
            <p>
              Votre adresse email a bien été vérifiée. Votre compte est en attente de
              validation par un administrateur. Vous recevrez un email dès qu'il sera activé.
            </p>
          </div>
        </template>

        <template v-else-if="step === 'error'">
          <div class="login-header">
            <svg class="svg" viewBox="0 0 52 52" stroke="#e74c3c">
              <circle class="svg-circle" cx="26" cy="26" r="25" fill="none" />
              <path class="svg-cross" fill="none" d="M16 16 36 36 M36 16 16 36" />
            </svg>
            <h2 class="themed-h2">Lien invalide ou expiré</h2>
          </div>
          <div class="login-body">
            <p>Ce lien de confirmation est invalide ou a expiré. Veuillez refaire une inscription.</p>
          </div>
        </template>

        <template v-else>
          <div class="login-header"><p>Vérification en cours...</p></div>
        </template>

        <div v-if="step !== 'loading'" class="login-footer">
          <button class="themed-button button-secondary" @click="$emit('switch')">
            Retour à la connexion
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api'

const props = defineProps({ token: String })
defineEmits(['switch'])

const step = ref('loading') // 'loading' | 'done' | 'error'

onMounted(async () => {
  try {
    await api.post('/auth/verify-email', { token: props.token })
    step.value = 'done'
  } catch {
    step.value = 'error'
  }
})
</script>
