<template>
  <div class="passwordsList-main-wrapper">
    <header class="passwordsList-header">
      <div class="passwordsList-heading">
        <h1 class="themed-h1 passwordsList-title">Mes mots de passe</h1>
        <span class="pill" :aria-label="`${passwordsList.length} entrées`">{{ passwordsList.length }}</span>
      </div>
      <div class="passwordsList-actions">
        <div class="search-wrap" v-if="passwordsList.length !== 0">
          <span class="material-icons search-icon" aria-hidden="true">search</span>
          <input
            class="themed-input search-input"
            v-model="search"
            type="search"
            placeholder="Rechercher..."
            aria-label="Rechercher un mot de passe"
          />
        </div>
        <button
          class="themed-button button-primary add-button"
          type="button"
          @click="openCreate()"
        >
          <span class="material-icons" aria-hidden="true">add</span>
          Ajouter
        </button>
      </div>
    </header>

    <div v-if="loading" class="loading">Chargement...</div>

    <div v-else-if="filteredPasswords.length === 0" class="empty">
      Aucun mot de passe
    </div>

    <div v-else class="passwordsList-wrapper">
      <div class="passwordsList" ref="passwordsListRef">
        <section
          v-for="group in groupedPasswords"
          :key="group.letter"
          class="password-group"
          :id="`group-${group.letter}`"
          :aria-labelledby="`group-title-${group.letter}`"
        >
          <h2 class="password-group-letter" :id="`group-title-${group.letter}`">{{ group.letter }}</h2>
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
        </section>
      </div>

      <PasswordsAlphabet
        :available="groupedPasswords.map((g) => g.letter)"
        @scroll="scrollToLetter"
      />
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

    const decrypted = await decryptPassword(
      password.password,
      session.moduleKey
    )
    decryptedModalPassword.value = decrypted

    form.value = { ...password, password: decrypted }
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
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  box-sizing: border-box;
}

.passwordsList-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.passwordsList-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.passwordsList-title {
  margin: 0;
}

.passwordsList-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.search-wrap {
  position: relative;
  width: 280px;
  max-width: 100%;
}
.search-icon {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 19px;
  color: var(--mp-faint);
  pointer-events: none;
}
.search-input {
  margin: 0;
  padding-left: 40px;
}

.add-button {
  width: auto;
}

.passwordsList-wrapper {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.passwordsList {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  padding: 2px 2px 1rem;
}

.password-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.password-group-letter {
  font-family: var(--mp-font-head);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--mp-muted);
  margin: 14px 0 2px 6px;
}
.password-group:first-child .password-group-letter {
  margin-top: 0;
}

.loading,
.empty {
  color: var(--mp-muted);
  margin-top: 2rem;
  font-size: 15px;
}

@media (max-width: 899px) {
  .passwordsList-actions,
  .search-wrap {
    width: 100%;
  }
  .search-wrap {
    flex: 1;
  }
}
</style>
