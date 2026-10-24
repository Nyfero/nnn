<template>
  <h2 class="themed-h2">Gestion du compte</h2>

  <div class="info-container">
    <div class="profil-info">
      <label class="themed-label">E-mail</label>
      <div class="info-row" v-if="authStore.user">
        <span>{{ authStore.user.email }}</span>
      </div>
    </div>

    <div class="profil-info">
      <label class="themed-label">Mot de passe</label>
      <div class="info-row">
        <span class="flex-2">••••••••</span>
        <button class="themed-button button-secondary flex-1 edit-btn" @click="showModal = true">
          <span>Modifier</span>
          <span class="material-icons">edit</span>
        </button>
      </div>
    </div>
  </div>

  <Toast ref="toastRef" />
  <ChangePasswordModal
    v-if="showModal"
    :loading="loading"
    :error="error"
    @close="showModal = false"
    @submit="handleChangePassword"
  />
</template>

<script setup>
import { ref } from 'vue'
import { Toast } from '@myprout/ui'
import { useProfile } from './useProfile'
import ChangePasswordModal from '@/components/modals/ChangePasswordModal.vue'

const { authStore, updatePassword } = useProfile()
const toastRef = ref(null)
const showModal = ref(false)
const loading = ref(false)
const error = ref('')

async function handleChangePassword({ oldPassword, newPassword }) {
  loading.value = true
  error.value = ''
  try {
    await updatePassword(oldPassword, newPassword)
    showModal.value = false
    toastRef.value?.show('Mot de passe modifié')
  } catch (e) {
    error.value = e.response?.data?.error ?? e.message ?? 'Une erreur est survenue'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.edit-btn { gap: 0.5rem; }
.edit-btn .material-icons { font-size: 1.1rem; }
</style>
