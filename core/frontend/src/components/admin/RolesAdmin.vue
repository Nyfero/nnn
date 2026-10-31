<template>
  <div class="admin-section">
    <h2 class="themed-h2">Droits des rôles</h2>

    <p v-if="loading" class="empty">Chargement...</p>

    <div v-else class="roles-list">
      <div v-for="r in roles" :key="r.role_id" class="role-card">
        <div class="r-head">
          <span class="r-name">{{ r.role }}</span>
          <span class="r-desc">{{ r.description }}</span>
        </div>

        <p v-if="r.locked" class="r-desc">
          Tous les modules, stockage illimité (non modifiable).
        </p>

        <template v-else>
          <label
            class="toggle"
            title="Les modules enregistrés plus tard sont accessibles automatiquement"
          >
            <input
              type="checkbox"
              :checked="r.all_modules"
              @change="patch(r, { all_modules: $event.target.checked })"
            />
            Dynamique : les nouveaux modules sont accessibles par défaut
          </label>

          <div class="r-modules">
            <label v-for="m in modules" :key="m.module_id" class="toggle">
              <input
                type="checkbox"
                :checked="r.modules.includes(m.module_id)"
                @change="toggleModule(r, m.module_id, $event.target.checked)"
              />
              <span class="material-icons th-icon">{{ m.icon }}</span>
              {{ m.name }}
            </label>
            <span v-if="modules.length === 0" class="r-desc"
              >Aucun module enregistré.</span
            >
          </div>

          <label class="quota">
            Stockage (Go)
            <input
              class="themed-input quota-input"
              type="number"
              min="0"
              step="0.5"
              placeholder="illimité"
              :value="toGb(r.storage_quota_mb)"
              @change="setQuota(r, $event.target.value)"
            />
          </label>
        </template>
      </div>
    </div>
    <p v-if="error" class="form-error">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api'

const roles = ref([])
const modules = ref([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const [r, m] = await Promise.all([
      api.get('/admin/roles'),
      api.get('/admin/modules'),
    ])
    roles.value = r.data
    modules.value = m.data
  } catch {
    error.value = 'Erreur lors du chargement'
  } finally {
    loading.value = false
  }
})

const toGb = (mb) => (mb === null || mb === undefined ? '' : mb / 1024)

async function save(role, request) {
  error.value = ''
  try {
    Object.assign(role, (await request()).data)
  } catch (e) {
    error.value = e.response?.data?.error ?? 'Enregistrement impossible'
    roles.value = [...roles.value] // restaure l'affichage
  }
}

const patch = (role, body) =>
  save(role, () => api.patch(`/admin/roles/${role.role_id}`, body))

const toggleModule = (role, id, checked) =>
  save(role, () =>
    api.put(`/admin/roles/${role.role_id}/modules`, {
      modules: checked
        ? [...role.modules, id]
        : role.modules.filter((m) => m !== id),
    })
  )

const setQuota = (role, value) =>
  patch(role, {
    storage_quota_mb: value === '' ? null : Math.round(Number(value) * 1024),
  })
</script>

<style scoped>
.admin-section {
  max-width: 800px;
  margin: 0 auto;
}
.empty {
  color: #aaa;
  text-align: center;
  margin-top: 3rem;
}
.roles-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.role-card {
  padding: 1rem 1.5rem;
  border-radius: 12px;
  background: #1e1e2e;
  border: 1px solid #2e2e3e;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.r-head {
  display: flex;
  align-items: baseline;
  gap: 0.8rem;
}
.r-name {
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--mp-accent);
}
.r-desc {
  color: #888;
  font-size: 0.85rem;
  margin: 0;
}
.r-modules {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: #ddd;
  cursor: pointer;
}
.toggle input {
  accent-color: #c25fff;
  width: 16px;
  height: 16px;
}
.th-icon {
  font-size: 1.1rem;
  color: var(--mp-accent);
}
.quota {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 0.9rem;
  color: #ddd;
}
.quota-input {
  width: 120px;
  margin: 0;
}
</style>
