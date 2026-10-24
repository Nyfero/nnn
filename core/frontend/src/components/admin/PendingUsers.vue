<template>
  <div class="admin-section">
    <h2 class="themed-h2">Inscriptions en attente</h2>

    <p v-if="loading" class="empty">Chargement...</p>
    <p v-else-if="pendingUsers.length === 0" class="empty">Aucune inscription en attente ✅</p>

    <div v-else class="users-list">
      <div v-for="user in pendingUsers" :key="user.user_id" class="user-card">
        <div class="user-info">
          <span class="user-name">{{ user.firstName }} {{ user.lastName }}</span>
          <span class="user-email">{{ user.email }}</span>
          <span class="user-date">Inscrit le {{ formatDate(user.created_at) }}</span>
        </div>
        <div class="user-actions">
          <button class="btn btn-approve" @click="approve(user)" :disabled="busy === user.user_id">✅ Valider</button>
          <button class="btn btn-reject" @click="reject(user)" :disabled="busy === user.user_id">❌ Refuser</button>
        </div>
      </div>
    </div>
    <p v-if="error" class="form-error">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api'

const pendingUsers = ref([])
const loading = ref(true)
const busy = ref(null)
const error = ref('')

onMounted(async () => {
  try {
    pendingUsers.value = (await api.get('/admin/pending-users')).data
  } catch {
    error.value = 'Erreur lors du chargement des inscriptions'
  } finally {
    loading.value = false
  }
})

async function act(user, request) {
  busy.value = user.user_id
  error.value = ''
  try {
    await request()
    pendingUsers.value = pendingUsers.value.filter((u) => u.user_id !== user.user_id)
  } catch (e) {
    error.value = e.response?.data?.error ?? 'Une erreur est survenue'
  } finally {
    busy.value = null
  }
}

const approve = (user) =>
  confirm(`Valider le compte de ${user.email} ?`) &&
  act(user, () => api.post(`/admin/approve/${user.user_id}`))

const reject = (user) =>
  confirm(`Refuser et supprimer le compte de ${user.email} ?`) &&
  act(user, () => api.delete(`/admin/reject/${user.user_id}`))

const formatDate = (d) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
</script>

<style scoped>
.admin-section { max-width: 800px; margin: 0 auto; }
.empty { color: #aaa; text-align: center; margin-top: 3rem; }
.users-list { display: flex; flex-direction: column; gap: 1rem; }
.user-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 1.5rem;
  border-radius: 12px;
  background: #1e1e2e;
  border: 1px solid #2e2e3e;
}
.user-info { display: flex; flex-direction: column; gap: 0.3rem; }
.user-name { font-weight: 600; }
.user-email { color: #aaa; font-size: 0.9rem; }
.user-date { color: #666; font-size: 0.8rem; }
.user-actions { display: flex; gap: 0.8rem; }
.btn { padding: 0.5rem 1rem; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; color: #fff; transition: opacity 0.2s; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn:hover:not(:disabled) { opacity: 0.85; }
.btn-approve { background: #22c55e; }
.btn-reject { background: #ef4444; }
</style>
