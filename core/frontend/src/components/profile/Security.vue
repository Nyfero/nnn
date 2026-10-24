<template>
  <h2 class="themed-h2">Sécurité</h2>

  <div class="security-item">
    <div class="security-item-info flex-2">
      <span class="material-icons security-icon">delete_forever</span>
      <div>
        <p class="security-item-title">Supprimer le compte</p>
        <p class="security-item-desc">Cette action est irréversible</p>
      </div>
    </div>
    <button v-if="!authStore.isAdmin" class="themed-button button-danger flex-1" @click="showModal = true">
      Supprimer
    </button>
    <p v-else class="security-item-desc">Un compte administrateur ne peut pas être supprimé.</p>
  </div>

  <DeleteAccountModal
    v-if="showModal"
    :loading="loading"
    :error="error"
    @close="showModal = false"
    @submit="handleDelete"
  />
</template>

<script setup>
import { ref } from 'vue'
import { useProfile } from './useProfile'
import DeleteAccountModal from '@/components/modals/DeleteAccountModal.vue'

const { authStore, deleteAccount, logout } = useProfile()
const showModal = ref(false)
const loading = ref(false)
const error = ref('')

async function handleDelete(password) {
  loading.value = true
  error.value = ''
  try {
    await deleteAccount(password)
    await logout()
  } catch (e) {
    error.value = e.response?.data?.error ?? 'Une erreur est survenue'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.security-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 0;
}
.security-item-info { display: flex; align-items: center; gap: 0.8rem; }
.security-icon { font-size: 1.8rem; color: var(--mp-danger); }
.security-item-title { font-weight: 600; font-size: 0.95rem; margin: 0; color: var(--mp-danger); }
.security-item-desc { font-size: 0.78rem; opacity: 0.6; margin: 2px 0 0; }
</style>
