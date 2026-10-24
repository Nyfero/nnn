<template>
  <div class="unlock-container">
    <div class="themed-card login-card">
      <h2 class="themed-h2">Déverrouiller votre coffre</h2>
      <p class="info-text">
        Votre clé de chiffrement n'est plus présente sur cet appareil.
        Saisissez votre mot de passe pour la restaurer.
      </p>
      <form class="login-body" @submit.prevent="unlock">
        <div class="form-wrapper">
          <input
            class="themed-input"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Mot de passe"
            autocomplete="current-password"
            autofocus
          />
          <div class="input-actions">
            <button class="toggle-password" type="button" tabindex="-1" @click="showPassword = !showPassword">
              <span class="material-icons">{{ showPassword ? 'visibility_off' : 'visibility' }}</span>
            </button>
          </div>
        </div>
        <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
        <div class="login-footer">
          <button class="themed-button button-primary" type="submit" :disabled="!password || loading">
            {{ loading ? 'Déchiffrement...' : 'Déverrouiller' }}
          </button>
          <button class="themed-button button-secondary" type="button" @click="logout">
            Se déconnecter
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { navigateAfterAuth } from '@/router'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const password = ref('')
const showPassword = ref(false)
const errorMessage = ref('')
const loading = ref(false)

async function unlock() {
  loading.value = true
  errorMessage.value = ''
  try {
    await auth.unlockKey(password.value)
    await navigateAfterAuth(route.query.redirect)
  } catch {
    errorMessage.value = 'Mot de passe incorrect'
  } finally {
    loading.value = false
  }
}

async function logout() {
  await auth.logout()
  router.push({ name: 'Login' })
}
</script>

<style scoped>
.unlock-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}
</style>
