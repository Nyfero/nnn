<template>
  <div class="admin-section">
    <h2 class="themed-h2">Accès aux modules</h2>

    <p v-if="loading" class="empty">Chargement...</p>
    <p v-else-if="modules.length === 0" class="empty">
      Aucun module enregistré. Ils apparaissent ici dès qu'un module démarre.
    </p>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Utilisateur</th>
            <th v-for="m in modules" :key="m.module_id">
              <span class="material-icons th-icon">{{ m.icon }}</span>
              {{ m.name }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.user_id">
            <td>
              <div class="u-name">{{ u.firstName }} {{ u.lastName }}
                <span v-if="u.isAdmin" class="badge">admin</span>
              </div>
              <div class="u-email">{{ u.email }}</div>
            </td>
            <td v-for="m in modules" :key="m.module_id" class="cell">
              <span v-if="u.isAdmin" class="all" title="Les administrateurs ont accès à tout">✓</span>
              <input
                v-else
                type="checkbox"
                :checked="u.modules.includes(m.module_id)"
                :disabled="saving === u.user_id"
                @change="toggle(u, m.module_id, $event.target.checked)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-if="error" class="form-error">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '@/services/api'

const users = ref([])
const modules = ref([])
const loading = ref(true)
const saving = ref(null)
const error = ref('')

onMounted(async () => {
  try {
    const [u, m] = await Promise.all([api.get('/admin/users'), api.get('/admin/modules')])
    users.value = u.data
    modules.value = m.data
  } catch {
    error.value = 'Erreur lors du chargement'
  } finally {
    loading.value = false
  }
})

async function toggle(user, moduleId, checked) {
  const next = checked
    ? [...user.modules, moduleId]
    : user.modules.filter((id) => id !== moduleId)
  saving.value = user.user_id
  error.value = ''
  try {
    const { data } = await api.put(`/admin/users/${user.user_id}/modules`, { modules: next })
    user.modules = data.modules
  } catch (e) {
    error.value = e.response?.data?.error ?? 'Enregistrement impossible'
    user.modules = [...user.modules] // restaure l'état des cases
  } finally {
    saving.value = null
  }
}
</script>

<style scoped>
.admin-section { max-width: 1000px; margin: 0 auto; }
.empty { color: #aaa; text-align: center; margin-top: 3rem; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 0.8rem 1rem; text-align: center; border-bottom: 1px solid #2e2e3e; }
th:first-child, td:first-child { text-align: left; }
th { font-weight: 600; color: #ddd; white-space: nowrap; }
.th-icon { font-size: 1.1rem; vertical-align: middle; color: var(--mp-accent); }
.u-name { font-weight: 600; }
.u-email { color: #aaa; font-size: 0.85rem; }
.badge { background: var(--mp-accent-dark); font-size: 0.7rem; padding: 2px 6px; border-radius: 6px; margin-left: 6px; }
.cell input { width: 18px; height: 18px; accent-color: #c25fff; cursor: pointer; }
.all { color: #4bb543; }
</style>
