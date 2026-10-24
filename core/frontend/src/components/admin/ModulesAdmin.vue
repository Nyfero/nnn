<template>
  <div class="admin-section">
    <h2 class="themed-h2">Modules</h2>

    <p v-if="loading" class="empty">Chargement...</p>
    <p v-else-if="modules.length === 0" class="empty">
      Aucun module enregistré. Ils s'enregistrent automatiquement au démarrage.
    </p>

    <div v-else class="modules-list">
      <div v-for="m in modules" :key="m.module_id" class="module-card" :class="{ off: !m.is_enabled }">
        <span class="material-icons m-icon">{{ m.icon }}</span>
        <div class="m-info">
          <span class="m-name">{{ m.name }}</span>
          <span class="m-meta">
            {{ m.module_id }} · {{ m.path }}<template v-if="m.version"> · v{{ m.version }}</template>
          </span>
          <span class="m-meta">Vu pour la dernière fois : {{ formatDate(m.last_seen_at) }}</span>
        </div>
        <label class="toggle">
          <input type="checkbox" :checked="m.is_enabled" @change="update(m, { is_enabled: $event.target.checked })" />
          Activé
        </label>
        <label class="toggle" title="Les nouveaux comptes validés reçoivent l'accès automatiquement">
          <input type="checkbox" :checked="m.auto_grant" @change="update(m, { auto_grant: $event.target.checked })" />
          Accès auto
        </label>
      </div>
    </div>
    <p v-if="error" class="form-error">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api'

const modules = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    modules.value = (await api.get('/admin/modules')).data
  } catch {
    error.value = 'Erreur lors du chargement des modules'
  } finally {
    loading.value = false
  }
})

async function update(module, patch) {
  error.value = ''
  try {
    const { data } = await api.patch(`/admin/modules/${module.module_id}`, patch)
    Object.assign(module, data)
  } catch (e) {
    error.value = e.response?.data?.error ?? 'Enregistrement impossible'
    Object.assign(module, {}) // force le rafraîchissement des cases
    modules.value = [...modules.value]
  }
}

const formatDate = (d) =>
  new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
</script>

<style scoped>
.admin-section { max-width: 800px; margin: 0 auto; }
.empty { color: #aaa; text-align: center; margin-top: 3rem; }
.modules-list { display: flex; flex-direction: column; gap: 1rem; }
.module-card {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  background: #1e1e2e;
  border: 1px solid #2e2e3e;
}
.module-card.off { opacity: 0.55; }
.m-icon { font-size: 2rem; color: var(--mp-accent); }
.m-info { flex: 1; display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.m-name { font-weight: 600; font-size: 1.05rem; }
.m-meta { color: #888; font-size: 0.8rem; }
.toggle { display: flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; color: #ddd; cursor: pointer; white-space: nowrap; }
.toggle input { accent-color: #c25fff; width: 16px; height: 16px; }
</style>
