<template>
  <BaseModal @close="$emit('close')">
    <!-- Header -->
    <template #header>
      <div class="modal-header-empty" />

      <div class="modal-header-title">
        <h2 class="themed-h2">
          {{
            modalMode === 'create'
              ? 'Nouveau mot de passe'
              : modalMode === 'edit'
                ? 'Modifier'
                : localForm.title
          }}
        </h2>
      </div>

      <div class="modal-header-actions">
        <button class="modal-close" @click="$emit('close')">
          <span class="material-icons">close</span>
        </button>
      </div>
    </template>

    <!-- Body -->
    <div class="modal-form">
      <!-- Titre -->
      <div class="form-group">
        <label class="themed-label">Titre</label>
        <input
          v-if="modalMode !== 'view'"
          class="themed-input"
          v-model="localForm.title"
          type="text"
          placeholder="Google, Youtube..."
          required
        />
        <span v-else class="form-value">{{ localForm.title }}</span>
      </div>

      <!-- Username -->
      <div class="form-group">
        <label class="themed-label">Nom d'utilisateur</label>
        <div class="form-wrapper">
          <input
            v-if="modalMode !== 'view'"
            class="themed-input"
            v-model="localForm.username"
            type="text"
            placeholder="email@exemple.com"
          />
          <span v-else class="form-value">{{ localForm.username || '—' }}</span>
          <div class="input-actions">
            <button
              class="copy-btn"
              @click="copyToClipboard(localForm.username, 'username')"
              title="Copier"
            >
              <span class="material-icons">{{
                copied === 'username' ? 'check' : 'content_copy'
              }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Password -->
      <div class="form-group">
        <label class="themed-label">Mot de passe</label>
        <div class="form-wrapper">
          <input
            v-if="modalMode !== 'view'"
            class="themed-input"
            v-model="localForm.password"
            :type="showPassword ? 'text' : 'password'"
            required
          />
          <span v-else class="form-value password-value">{{
            showPassword ? decryptedPassword || '••••••••' : '••••••••'
          }}</span>
          <div class="input-actions">
            <button
              class="toggle-password"
              @click="showPassword = !showPassword"
            >
              <span class="material-icons">{{
                showPassword ? 'visibility_off' : 'visibility'
              }}</span>
            </button>
            <button
              v-if="modalMode !== 'view'"
              class="copy-btn"
              @click="generatePassword"
              title="Générer"
            >
              <span class="material-icons">casino</span>
            </button>
            <button
              v-else
              class="copy-btn"
              @click="copyToClipboard(decryptedPassword, 'password')"
              title="Copier"
            >
              <span class="material-icons">{{
                copied === 'password' ? 'check' : 'content_copy'
              }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Note -->
      <div class="form-group">
        <label class="themed-label">Note</label>
        <textarea
          v-if="modalMode !== 'view'"
          class="themed-textarea"
          v-model="localForm.note"
          rows="3"
          placeholder="Note optionnelle..."
          maxlength="300"
        />
        <span v-else class="form-value">{{ localForm.note || '—' }}</span>
        <span
          v-if="modalMode !== 'view'"
          class="char-counter"
          :class="{ 'near-limit': localForm.note?.length >= 270 }"
        >
          {{ localForm.note?.length || 0 }}/300
        </span>
      </div>

      <p v-if="error" class="form-error">{{ error }}</p>
    </div>

    <!-- Footer -->
    <template #footer>
      <div class="modal-footer-left">
        <button
          v-if="modalMode === 'edit'"
          class="themed-button button-secondary btn-delete"
          @click="$emit('delete')"
        >
          <span>Supprimer</span>
          <span class="material-icons">delete</span>
        </button>
      </div>

      <!-- Mode création / édition -->
      <div class="modal-footer-right" v-if="modalMode !== 'view'">
        <button
          class="themed-button button-secondary"
          v-if="modalMode === 'edit'"
          @click="$emit('switch-mode', 'view')"
        >
          Annuler
        </button>
        <button
          class="themed-button button-primary"
          :disabled="loading"
          @click="$emit('submit', localForm)"
        >
          {{ loading ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
      </div>

      <!-- Mode vue -->
      <div class="modal-footer-right" v-else>
        <button
          class="themed-button button-secondary btn-edit"
          @click="$emit('switch-mode', 'edit')"
        >
          <span>Modifier</span>
          <span class="material-icons edit-icon">edit</span>
        </button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { BaseModal } from '@myprout/ui'

const props = defineProps({
  modalMode: { type: String, default: 'create' },
  form: { type: Object, required: true },
  decryptedPassword: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

const emit = defineEmits(['close', 'submit', 'delete', 'switch-mode'])

const showPassword = ref(props.modalMode !== 'view')
const localForm = ref({ ...props.form })
const copied = ref(null)

const copyToClipboard = async (text, field) => {
  try {
    await navigator.clipboard.writeText(text)
    copied.value = field
    setTimeout(() => (copied.value = null), 2000)
  } catch (err) {
    console.error('Erreur copie :', err)
  }
}

// Tirage cryptographiquement sûr (et non Math.random)
const randomIndex = (max) => {
  const limit = Math.floor(0x100000000 / max) * max
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf)
  while (buf[0] >= limit)
  return buf[0] % max
}

const generatePassword = () => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const numbers = '0123456789'
  const symbols = '!-_=+?*.,;:'
  const all = lowercase + uppercase + numbers + symbols
  const pick = (set) => set[randomIndex(set.length)]

  const password = [
    pick(lowercase),
    pick(uppercase),
    pick(numbers),
    pick(symbols),
  ]
  for (let i = 4; i < 16; i++) password.push(pick(all))

  // Mélange de Fisher-Yates
  for (let i = password.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[password[i], password[j]] = [password[j], password[i]]
  }

  localForm.value.password = password.join('')
  showPassword.value = true
}

watch(
  () => props.form,
  (val) => {
    localForm.value = { ...val }
    showPassword.value = props.modalMode !== 'view'
  },
  { deep: true }
)

watch(
  () => props.modalMode,
  (newMode) => {
    showPassword.value = newMode !== 'view'
    if (newMode === 'edit') {
      localForm.value.password = props.decryptedPassword
    }
  }
)

function isFormValid() {
  return localForm.value.title?.trim() && localForm.value.password?.trim()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

function handleKeydown(e) {
  // Entrée valide le formulaire, sauf dans la note (saut de ligne)
  if (e.target?.tagName === 'TEXTAREA') return
  if (e.key === 'Enter' && props.modalMode !== 'view' && isFormValid()) {
    emit('submit', localForm.value)
  }
}
</script>

<style scoped>
.btn-edit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-delete {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid transparent;
}
.btn-delete:hover {
  border-color: #ff5555;
  color: #ff5555;
}
</style>
