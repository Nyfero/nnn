<template>
  <div class="admin-section">
    <div class="admin-head">
      <h2 class="themed-h2">Gestion des serveurs</h2>
      <button class="themed-button button-primary add-btn" @click="openCreate">Ajouter +</button>
    </div>

    <p v-if="loading" class="empty">Chargement...</p>
    <p v-else-if="servers.length === 0" class="empty">
      Aucun serveur déclaré. Ajoutez le nom d'un conteneur Docker existant.
    </p>

    <div v-else class="rows">
      <div v-for="s in servers" :key="s.server_id" class="row">
        <div class="info">
          <span class="name">{{ s.name }}</span>
          <span class="meta mono">{{ s.container }}</span>
          <span class="meta" :class="{ bad: s.status === 'missing' || s.error }">
            {{ statusLabel(s) }} · {{ s.user_ids.length }} utilisateur(s) autorisé(s)
          </span>
        </div>
        <button class="icon-btn" title="Modifier" @click="openEdit(s)">
          <span class="material-icons">edit</span>
        </button>
        <button class="icon-btn danger" title="Retirer de la liste" @click="remove(s)">
          <span class="material-icons">delete</span>
        </button>
      </div>
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>

    <ServerFormModal
      v-if="showModal"
      :server="editing"
      :users="users"
      :loading="formLoading"
      :error="formError"
      @close="showModal = false"
      @submit="save"
    />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api'
import coreApi from '@/services/coreApi'
import { MODULE_ID } from '@/stores/session'
import ServerFormModal from './ServerFormModal.vue'

const servers = ref([])
const users = ref([])
const loading = ref(true)
const error = ref('')
const showModal = ref(false)
const editing = ref(null)
const formLoading = ref(false)
const formError = ref('')

const STATUS = {
  running: 'En ligne',
  exited: 'Hors ligne',
  created: 'Hors ligne',
  missing: 'Conteneur introuvable',
}
const statusLabel = (s) => (s.error ? 'Indisponible' : (STATUS[s.status] ?? s.status))

async function load() {
  try {
    servers.value = (await api.get('/admin')).data
    error.value = ''
  } catch (e) {
    error.value = e.response?.data?.error ?? 'Erreur lors du chargement'
  }
}

onMounted(async () => {
  await load()
  try {
    // Seuls les utilisateurs (non-admin) ayant accès au module peuvent recevoir une permission
    const { data } = await coreApi.get('/admin/users')
    users.value = data.filter((u) => !u.isAdmin && u.modules.includes(MODULE_ID))
  } catch {
    error.value ||= 'Impossible de charger la liste des utilisateurs'
  }
  loading.value = false
})

function openCreate() {
  editing.value = null
  formError.value = ''
  showModal.value = true
}

function openEdit(server) {
  editing.value = server
  formError.value = ''
  showModal.value = true
}

async function save(payload) {
  formLoading.value = true
  formError.value = ''
  try {
    if (editing.value) await api.put(`/admin/${editing.value.server_id}`, payload)
    else await api.post('/admin', payload)
    showModal.value = false
    await load()
  } catch (e) {
    formError.value = e.response?.data?.error ?? 'Enregistrement impossible'
  } finally {
    formLoading.value = false
  }
}

async function remove(server) {
  if (!confirm(`Retirer « ${server.name} » de la liste ? Le conteneur Docker n'est pas touché.`)) return
  try {
    await api.delete(`/admin/${server.server_id}`)
    await load()
  } catch (e) {
    error.value = e.response?.data?.error ?? 'Suppression impossible'
  }
}
</script>

<style scoped>
.admin-section { max-width: 800px; margin: 0 auto; }
.admin-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
.add-btn { width: auto; padding: 10px 20px; }
.empty { color: #aaa; text-align: center; margin-top: 3rem; }
.rows { display: flex; flex-direction: column; gap: 1rem; }
.row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  background: #1e1e2e;
  border: 1px solid #2e2e3e;
}
.info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.2rem; }
.name { font-weight: 600; font-size: 1.05rem; }
.meta { color: #888; font-size: 0.8rem; }
.meta.bad { color: #ff5555; }
.mono { font-family: monospace; }
.icon-btn {
  background: transparent;
  border: 1px solid #444;
  border-radius: 6px;
  color: #ccc;
  cursor: pointer;
  padding: 0.3rem;
  display: flex;
  transition: all 0.2s;
}
.icon-btn:hover { border-color: var(--mp-accent); color: var(--mp-accent); }
.icon-btn.danger:hover { border-color: #ff5555; color: #ff5555; }
</style>
