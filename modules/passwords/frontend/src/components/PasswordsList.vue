<template>
  <div class="passwordsList-main-wrapper">
    <div class="passwordsList-header">
      <h1 class="themed-h1 passwordsList-title">
        Mes mots de passe ({{ passwordsList.length }})
      </h1>
      <div class="passwordsList-actions">
        <button
          class="themed-button button-primary add-wrap"
          @click="openCreate()"
        >
          Ajouter +
        </button>
        <div class="filter-wrap" v-if="passwordsList.length !== 0">
          <input
            class="themed-input search-input"
            v-model="search"
            type="text"
            placeholder="Rechercher..."
          />
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">Chargement...</div>

    <div v-else-if="filteredPasswords.length === 0" class="empty">
      Aucun mot de passe
    </div>

    <div v-else class="passwordsList-wrapper">
      <PasswordsAlphabet @scroll="scrollToLetter" />

      <div class="passwordsList" ref="passwordsListRef">
        <div
          v-for="group in groupedPasswords"
          :key="group.letter"
          class="password-group"
          :id="`group-${group.letter}`"
        >
          <div class="password-group-letter">{{ group.letter }}</div>
          <PasswordsCard
            v-for="password in group.passwords"
            :key="password.password_id"
            :password="password"
            :icon="icons[extractDomain(password.title)]"
            :isVisible="visiblePasswords[password.password_id] !== undefined"
            :decryptedValue="visiblePasswords[password.password_id]"
            @toggle-favorite="toggleFavorite"
            @toggle-show="toggleShowPassword"
            @copy="handleCopyPassword"
            @click="openView(password)"
          />
        </div>
      </div>
    </div>
  </div>
  <Toast ref="toastRef" />

  <PasswordsModal
    v-if="showModal"
    :modal-mode="modalMode"
    :form="form"
    :loading="formLoading"
    :error="formError"
    :decryptedPassword="decryptedModalPassword"
    @close="closeModal"
    @submit="submitPassword"
    @delete="handleDeletePassword(editingId)"
    @switch-mode="modalMode = $event"
  />
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Toast } from '@myprout/ui'
import { usePasswords } from '@/composables/usePasswords'
import { useSession } from '@/stores/session'
import { decryptPassword } from '@/utils/crypto'
import PasswordsCard from './PasswordsCard.vue'
import PasswordsModal from './PasswordsModal.vue'
import PasswordsAlphabet from './PasswordsAlphabet.vue'

const session = useSession()
const passwordsListRef = ref(null)
const toastRef = ref(null)

const {
  passwordsList,
  loading,
  search,
  visiblePasswords,
  icons,
  filteredPasswords,
  groupedPasswords,
  extractDomain,
  toggleFavorite,
  toggleShowPassword,
  decryptForCopy,
  createPassword,
  updatePassword,
  deletePassword,
  fetchPasswordsList,
} = usePasswords()

onMounted(fetchPasswordsList)

// --- Scroll ---
const scrollToLetter = (letter) => {
  const target = document.getElementById(`group-${letter}`)
  const list = passwordsListRef.value
  if (!target || !list) return
  const listRect = list.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  list.scrollTo({
    top: list.scrollTop + (targetRect.top - listRect.top),
    behavior: 'smooth',
  })
}

// --- Modal ---
const showModal = ref(false)
const formLoading = ref(false)
const formError = ref('')
const editingId = ref(null)
const modalMode = ref('create') // 'create' | 'view' | 'edit'
const form = ref({ title: '', username: '', password: '', note: '' })
const decryptedModalPassword = ref('')

function openView(password) {
  openModal(password, 'view')
}

function openCreate() {
  openModal(null, 'create')
}

async function openModal(password = null, mode = 'create') {
  modalMode.value = mode
  if (password) {
    editingId.value = password.password_id

    const decrypted = await decryptPassword(password.password, session.moduleKey)
    decryptedModalPassword.value = decrypted

    form.value = {
      ...password,
      password: mode === 'edit' ? decrypted : password.password,
    }
  } else {
    editingId.value = null
    form.value = { title: '', username: '', password: '', note: '' }
    decryptedModalPassword.value = ''
  }
  showModal.value = true
}

function closeModal() {
  showModal.value = false
}

// --- Actions avec feedback UI ---
async function submitPassword(formData) {
  formLoading.value = true
  formError.value = ''
  try {
    if (modalMode.value === 'edit') {
      await updatePassword(editingId.value, formData)
      toastRef.value?.show('Mot de passe modifié')
    } else {
      await createPassword(formData)
      toastRef.value?.show('Mot de passe créé')
    }
    closeModal()
  } catch {
    formError.value = "Erreur lors de l'enregistrement"
  } finally {
    formLoading.value = false
  }
}

async function handleCopyPassword(encryptedPassword) {
  try {
    const decrypted = await decryptForCopy(encryptedPassword)
    await navigator.clipboard.writeText(decrypted)
    toastRef.value?.show('Mot de passe copié')
  } catch {
    console.error('Erreur lors de la copie')
  }
}

async function handleDeletePassword(id) {
  if (!confirm('Supprimer ce mot de passe ?')) return
  try {
    await deletePassword(id)
    toastRef.value?.show('Mot de passe supprimé')
    closeModal()
  } catch {
    console.error('Erreur lors de la suppression')
  }
}
</script>

<style scoped>
.passwordsList-main-wrapper {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  scrollbar-width: none;
  box-sizing: border-box;
}

.passwordsList-main-wrapper::-webkit-scrollbar {
  display: none;
}

.passwordsList-header {
  display: flex;
  align-items: center;
  margin-bottom: 1.5rem;
  position: sticky;
  top: 0;
  z-index: 10;
  background: black;
  padding: 1rem;
}

.passwordsList-title {
  flex: 1;
}

.passwordsList-actions {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.add-wrap {
  flex: 1;
}

.filter-wrap {
  flex: 2;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.search-input {
  flex: 9;
  padding: 12px;
}

.password-group-letter {
  display: flex;
  align-items: center;
  gap: 1rem;
  font-size: 1.5rem;
  font-weight: bold;
  color: #f9f0a8;
  padding: 0.5rem 0;
  margin-top: 1rem;
}

.password-group-letter::after {
  content: '';
  flex: 1;
  height: 1px;
  background-color: #f7e96e;
  opacity: 0.3;
}

.passwordsList-wrapper {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.passwordsList {
  display: flex;
  flex: 97%;
  flex-direction: column;
  gap: 0.8rem;
  overflow-y: auto;
  scrollbar-width: none;
  padding-bottom: 1rem;
}

.passwordsList::-webkit-scrollbar {
  display: none;
}

.loading,
.empty {
  text-align: center;
  color: #aaa;
  margin-top: 3rem;
  font-size: 1.1rem;
}
</style>
