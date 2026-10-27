<template>
  <div class="themed-card login-card">
    <transition name="fade" mode="out-in">
      <div :key="submitted ? 'done' : 'register'">
        <template v-if="!submitted">
          <div class="login-header">
            <h2 class="themed-h2">Créer un compte</h2>
          </div>
          <div class="login-body">
            <form @submit.prevent="register">
              <input
                class="themed-input"
                v-model="form.lastName"
                type="text"
                placeholder="Nom"
                required
              />
              <input
                class="themed-input"
                v-model="form.firstName"
                type="text"
                placeholder="Prénom"
                required
              />
              <input
                class="themed-input"
                v-model="form.email"
                type="email"
                placeholder="E-mail"
                required
              />
              <p v-if="emailTaken" class="form-error">
                Cette adresse e-mail est déjà utilisée. S'il s'agit d'une
                erreur,
                <a class="contact-link" :href="contactHref"
                  >contactez l'administrateur</a
                >.
              </p>
              <p v-else-if="errorMessage" class="form-error">
                {{ errorMessage }}
              </p>

              <div class="login-footer">
                <button
                  class="themed-button button-primary"
                  type="submit"
                  :disabled="!isValid || isLoading"
                >
                  {{ isLoading ? 'En cours...' : "S'inscrire" }}
                </button>
                <button
                  class="themed-button button-secondary"
                  type="button"
                  @click="$emit('switch')"
                >
                  Déjà un compte ?
                </button>
              </div>
            </form>
          </div>
        </template>

        <template v-else>
          <div class="login-header">
            <svg class="svg" viewBox="0 0 52 52" stroke="#4bb543">
              <circle class="svg-circle" cx="26" cy="26" r="25" fill="none" />
              <path class="svg-check" fill="none" d="M14 27l7 7 16-16" />
            </svg>
            <h2 class="themed-h2">Inscription enregistrée</h2>
          </div>
          <div class="login-body">
            <p class="info-text">{{ successMessage }}</p>
          </div>
          <div class="login-footer">
            <button
              class="themed-button button-secondary"
              @click="$emit('switch')"
            >
              Revenir à la connexion
            </button>
          </div>
        </template>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import api from '@/services/api'

defineEmits(['switch'])

const submitted = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const form = ref({ lastName: '', firstName: '', email: '' })
const emailTaken = ref(false)

// Lien mailto vers l'admin, avec l'adresse concernée pré-remplie
const contactHref = computed(() => {
  const subject = 'Question myprout : Adresse email déjà utilisée'
  const body = `Bonjour,\n\nJe n'arrive pas à créer un compte avec l'adresse ${form.value.email}, qui est indiquée comme déjà utilisée.\n`
  return `mailto:contact@myprout.fr?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
})

const isValid = computed(
  () => form.value.lastName && form.value.firstName && form.value.email
)

async function register() {
  isLoading.value = true
  errorMessage.value = ''
  emailTaken.value = false
  try {
    const { data } = await api.post('/auth/register', form.value)
    successMessage.value = data.message
    form.value = { firstName: '', lastName: '', email: '' }
    submitted.value = true
  } catch (err) {
    if (err.response?.status === 409) emailTaken.value = true
    else
      errorMessage.value =
        err.response?.data?.error ?? 'Une erreur est survenue'
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.contact-link {
  color: var(--mp-accent);
  text-decoration: underline;
}
</style>
