<template>
  <div class="themed-card login-card">
    <transition name="fade" mode="out-in">
      <div :key="step">
        <!-- LOGIN -->
        <template v-if="step === 'login'">
          <div class="login-header"><h2 class="themed-h2">Connexion</h2></div>
          <div class="login-body">
            <form @submit.prevent="onSubmit">
              <input
                class="themed-input"
                v-model="form.email"
                type="email"
                placeholder="E-mail"
                autocomplete="username"
                required
              />
              <div class="form-wrapper">
                <input
                  class="themed-input"
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Mot de passe"
                  autocomplete="current-password"
                  required
                />
                <div class="input-actions">
                  <button
                    class="toggle-password"
                    type="button"
                    @click="showPassword = !showPassword"
                  >
                    <span class="material-icons">{{
                      showPassword ? 'visibility_off' : 'visibility'
                    }}</span>
                  </button>
                </div>
              </div>
              <a
                class="forgot-password"
                href="#"
                @click.prevent="step = 'forgot'"
              >
                Mot de passe oublié ?
              </a>
              <p class="form-error">{{ errorMessage }}</p>

              <div class="login-footer">
                <button
                  class="themed-button button-primary"
                  type="submit"
                  :disabled="!isLoginValid || isLoading"
                >
                  {{ isLoading ? 'En cours...' : 'Se connecter' }}
                </button>
                <button
                  class="themed-button button-secondary"
                  type="button"
                  @click="$emit('switch')"
                >
                  Créer un compte
                </button>
              </div>
            </form>
          </div>
        </template>

        <!-- FORGOT -->
        <template v-else-if="step === 'forgot'">
          <div class="login-header">
            <h2 class="themed-h2">Mot de passe oublié</h2>
          </div>
          <div class="login-body">
            <p class="info-text">
              Entrez votre adresse email pour recevoir un lien de
              réinitialisation.
            </p>
            <input
              class="themed-input"
              v-model="forgotEmail"
              type="email"
              placeholder="Votre email"
              :disabled="forgotLoading"
              @keyup.enter="handleForgotPassword"
            />
            <p v-if="forgotError" class="form-error">{{ forgotError }}</p>
          </div>
          <div class="login-footer">
            <button
              class="themed-button button-primary"
              @click="handleForgotPassword"
              :disabled="!forgotEmail || forgotLoading"
            >
              {{ forgotLoading ? 'Envoi...' : 'Envoyer le lien' }}
            </button>
            <button
              class="themed-button button-secondary"
              @click="step = 'login'"
            >
              Retour
            </button>
          </div>
        </template>

        <!-- EMAIL SENT -->
        <template v-else-if="step === 'email-sent'">
          <div class="login-header">
            <h2 class="themed-h2">Email envoyé !</h2>
          </div>
          <div class="login-body">
            <p>
              Si un compte existe pour cette adresse, un email de
              réinitialisation va être envoyé à :
            </p>
            <a
              v-if="mailboxUrl"
              :href="mailboxUrl"
              target="_blank"
              rel="noopener"
              class="themed-button button-primary email-link-btn"
            >
              <span class="material-icons">open_in_new</span>
              {{ forgotEmail }}
            </a>
            <strong v-else class="themed-label">{{ forgotEmail }}</strong>
            <p>Pensez à vérifier vos spams.</p>
          </div>
          <div class="login-footer">
            <button
              class="themed-button button-secondary"
              @click="step = 'login'"
            >
              Retour à la connexion
            </button>
          </div>
        </template>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/authStore'
import { navigateAfterAuth } from '@/router'
import { VaultError } from '@myprout/sdk/client'
import api from '@/services/api'

defineEmits(['switch'])

const step = ref('login') // 'login' | 'forgot' | 'email-sent'
const showPassword = ref(false)
const errorMessage = ref('')
const isLoading = ref(false)
const forgotEmail = ref('')
const forgotError = ref('')
const forgotLoading = ref(false)

const auth = useAuthStore()
const route = useRoute()

const form = ref({ email: '', password: '' })
const isLoginValid = computed(() => form.value.email && form.value.password)

const emailProviders = {
  'gmail.com': 'https://mail.google.com',
  'googlemail.com': 'https://mail.google.com',
  'outlook.com': 'https://outlook.live.com',
  'hotmail.com': 'https://outlook.live.com',
  'live.com': 'https://outlook.live.com',
  'yahoo.com': 'https://mail.yahoo.com',
  'yahoo.fr': 'https://mail.yahoo.com',
  'icloud.com': 'https://www.icloud.com/mail',
  'me.com': 'https://www.icloud.com/mail',
  'laposte.net': 'https://www.laposte.net/accueil',
  'orange.fr': 'https://mail.orange.fr',
  'free.fr': 'https://webmail.free.fr',
  'sfr.fr': 'https://webmail.sfr.fr',
}
const mailboxUrl = computed(
  () => emailProviders[forgotEmail.value.split('@')[1]?.toLowerCase()] ?? null
)

async function onSubmit() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    await auth.login(form.value.email, form.value.password)
    await navigateAfterAuth(route.query.redirect)
  } catch (error) {
    errorMessage.value =
      error instanceof VaultError
        ? 'Impossible de déverrouiller votre coffre. Contactez un administrateur.'
        : (error.response?.data?.error ?? 'Erreur de connexion au serveur')
  } finally {
    isLoading.value = false
  }
}

async function handleForgotPassword() {
  forgotLoading.value = true
  forgotError.value = ''
  try {
    await api.post('/auth/password/forgot', { email: forgotEmail.value })
    step.value = 'email-sent'
  } catch (error) {
    forgotError.value =
      error.response?.data?.error ?? 'Une erreur est survenue.'
  } finally {
    forgotLoading.value = false
  }
}
</script>

<style scoped>
.forgot-password {
  font-size: 0.9em;
  color: grey;
  text-decoration: underline;
  cursor: pointer;
}
.forgot-password:hover {
  color: var(--mp-accent);
}
.email-link-btn {
  color: #fff;
  text-decoration: none;
  gap: 0.5rem;
  box-sizing: border-box;
}
</style>
