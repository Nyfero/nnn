<template>
  <div class="themed-card login-card">
    <transition name="fade" mode="out-in">
      <div :key="step">
        <template v-if="step === 'questions'">
          <div class="login-header">
            <h2 class="themed-h2">
              {{ mode === 'verify' ? 'Vérification de votre identité' : 'Questions de sécurité' }}
            </h2>
            <p class="login-subtitle">
              {{
                mode === 'verify'
                  ? 'Répondez à vos questions de sécurité pour réinitialiser votre mot de passe.'
                  : 'Ces questions permettront de récupérer votre compte si vous oubliez votre mot de passe.'
              }}
            </p>
          </div>

          <div class="login-body">
            <form @submit.prevent="handleSubmit">
              <!-- VERIFY : questions imposées -->
              <template v-if="mode === 'verify'">
                <div v-for="(q, index) in verifyQuestions" :key="index" class="question-block">
                  <p class="question-label">{{ q.question }}</p>
                  <div class="form-wrapper">
                    <input class="themed-input" v-model="q.answer" type="text" placeholder="Votre réponse" maxlength="30" required />
                    <span class="char-counter" :class="{ 'near-limit': q.answer.length >= 20 }">
                      {{ q.answer.length }}/30
                    </span>
                  </div>
                </div>
              </template>

              <!-- SET : questions au choix -->
              <template v-else>
                <div v-for="(q, index) in questions" :key="index" class="question-block">
                  <p class="question-label">Question {{ index + 1 }}</p>

                  <select class="themed-select" v-model="q.selected" @change="q.custom = ''">
                    <option value="" disabled>Choisir une question...</option>
                    <optgroup label="Questions prédéfinies">
                      <option v-for="preset in availableQuestions(index)" :key="preset" :value="preset">
                        {{ preset }}
                      </option>
                    </optgroup>
                    <optgroup label="Questions personnalisées">
                      <option value="__custom__">✎ Écrire ma propre question</option>
                    </optgroup>
                  </select>

                  <div class="form-wrapper" v-if="q.selected === '__custom__'">
                    <input class="themed-input" v-model="q.custom" type="text" placeholder="Votre question personnalisée" maxlength="80" required />
                    <span class="char-counter" :class="{ 'near-limit': q.custom.length >= 60 }">
                      {{ q.custom.length }}/80
                    </span>
                  </div>

                  <div class="form-wrapper">
                    <input class="themed-input" v-model="q.answer" type="text" placeholder="Votre réponse" maxlength="30" required />
                    <span class="char-counter" :class="{ 'near-limit': q.answer.length >= 20 }">
                      {{ q.answer.length }}/30
                    </span>
                  </div>
                </div>
              </template>

              <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>

              <div class="login-footer">
                <button class="themed-button button-primary" type="submit" :disabled="isLoading">
                  {{ isLoading ? 'En cours...' : mode === 'verify' ? 'Vérifier' : 'Valider' }}
                </button>
                <button v-if="mode === 'set'" class="themed-button button-secondary" type="button" @click="$emit('back')">
                  Retour
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
            <h2 class="themed-h2">Compte activé avec succès !</h2>
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
import { ref, reactive, onMounted } from 'vue'
import { createVault, recoverMasterKeyHex } from '@myprout/sdk/client'
import api from '@/services/api'

const props = defineProps({
  token: String,
  password: String, // mode set : mot de passe choisi à l'étape précédente
  mode: { type: String, default: 'set' }, // 'set' | 'verify'
})
const emit = defineEmits(['back', 'switch', 'verified'])

const step = ref('questions')
const isLoading = ref(false)
const errorMessage = ref('')

const PRESET_QUESTIONS = [
  'Quel est le nom de votre premier animal de compagnie ?',
  'Quelle est la ville où vous êtes né(e) ?',
  "Quel est le prénom de votre meilleur(e) ami(e) d'enfance ?",
  "Quel est le nom de votre école primaire ?",
  'Quel est le modèle de votre première voiture ?',
  'Quel est le plat préféré de votre mère ?',
  'Quel était le surnom de votre grand-père ?',
  'Quelle est la rue où vous avez grandi ?',
]

const questions = reactive([
  { selected: '', custom: '', answer: '' },
  { selected: '', custom: '', answer: '' },
  { selected: '', custom: '', answer: '' },
])
const verifyQuestions = ref([])

onMounted(async () => {
  if (props.mode !== 'verify') return
  try {
    const { data } = await api.get('/auth/recovery', { params: { token: props.token } })
    verifyQuestions.value = data.questions.map((question) => ({ question, answer: '' }))
  } catch (error) {
    errorMessage.value = error.response?.data?.error ?? 'Token invalide ou expiré'
  }
})

function availableQuestions(currentIndex) {
  const taken = questions
    .filter((q, i) => i !== currentIndex && q.selected !== '__custom__')
    .map((q) => q.selected)
  return PRESET_QUESTIONS.filter((q) => !taken.includes(q))
}

function validateSet() {
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i]
    if (!q.selected) return `Veuillez sélectionner la question ${i + 1}`
    if (q.selected === '__custom__' && !q.custom.trim())
      return `Veuillez saisir votre question personnalisée (${i + 1})`
    if (!q.answer.trim()) return `Veuillez saisir une réponse pour la question ${i + 1}`
  }
  return ''
}

async function handleSubmit() {
  errorMessage.value = ''
  isLoading.value = true
  try {
    if (props.mode === 'verify') await verifyAnswers()
    else await activate()
  } catch (error) {
    errorMessage.value =
      error.response?.data?.error ?? error.message ?? 'Une erreur est survenue'
  } finally {
    isLoading.value = false
  }
}

// Activation : la clé maître est créée ici, dans le navigateur
async function activate() {
  const err = validateSet()
  if (err) throw new Error(err)

  const payload = questions.map((q) => ({
    question: q.selected === '__custom__' ? q.custom.trim() : q.selected,
    answer: q.answer.trim(),
  }))
  const vault = await createVault(props.password, payload.map((q) => q.answer))

  await api.post('/auth/activate', {
    token: props.token,
    password: props.password,
    security_questions: payload,
    ...vault,
  })
  step.value = 'done'
}

// Reset : le serveur contrôle les réponses, le client retrouve la clé maître
async function verifyAnswers() {
  const answers = verifyQuestions.value.map((q) => ({
    question: q.question,
    answer: q.answer.trim(),
  }))
  const { data } = await api.post('/auth/recovery/verify', {
    token: props.token,
    security_questions: answers,
  })
  const masterKey = await recoverMasterKeyHex(
    answers.map((a) => a.answer),
    data
  )
  emit('verified', { token: props.token, masterKey })
}
</script>
