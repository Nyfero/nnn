<template>
  <div class="admin-section">
    <h2 class="themed-h2">Rôles des utilisateurs</h2>

    <p v-if="loading" class="empty">Chargement...</p>

    <div v-else class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Utilisateur</th>
            <th v-for="r in roles" :key="r.role_id" :title="r.description">
              {{ r.role }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.user_id">
            <td>
              <div class="u-name">{{ u.firstName }} {{ u.lastName }}</div>
              <div class="u-email">{{ u.email }}</div>
            </td>
            <td v-for="r in roles" :key="r.role_id" class="cell">
              <input
                type="checkbox"
                :checked="u.roles.includes(r.role)"
                :disabled="saving === u.user_id || u.user_id === me"
                :title="
                  u.user_id === me
                    ? 'Vous ne pouvez pas modifier vos propres rôles'
                    : ''
                "
                @change="toggle(u, r.role, $event)"
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
import { useAuthStore } from '@/stores/authStore'
import api from '@/services/api'

const me = useAuthStore().user?.user_id
const users = ref([])
const roles = ref([])
const loading = ref(true)
const saving = ref(null)
const error = ref('')

onMounted(async () => {
  try {
    const [u, r] = await Promise.all([
      api.get('/admin/users'),
      api.get('/admin/roles'),
    ])
    users.value = u.data
    roles.value = r.data
  } catch {
    error.value = 'Erreur lors du chargement'
  } finally {
    loading.value = false
  }
})

async function toggle(user, role, event) {
  const checked = event.target.checked
  if (
    role === 'ADMIN' &&
    checked &&
    !confirm(`Donner tous les droits à ${user.email} ?`)
  ) {
    event.target.checked = false
    return
  }
  const next = checked
    ? [...user.roles, role]
    : user.roles.filter((r) => r !== role)
  saving.value = user.user_id
  error.value = ''
  try {
    const { data } = await api.put(`/admin/users/${user.user_id}/roles`, {
      roles: next,
    })
    user.roles = data.roles
  } catch (e) {
    error.value = e.response?.data?.error ?? 'Enregistrement impossible'
    event.target.checked = !checked
  } finally {
    saving.value = null
  }
}
</script>

<style scoped>
.admin-section {
  max-width: 1000px;
  margin: 0 auto;
}
.empty {
  color: #aaa;
  text-align: center;
  margin-top: 3rem;
}
.table-wrap {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 0.8rem 1rem;
  text-align: center;
  border-bottom: 1px solid #2e2e3e;
}
th:first-child,
td:first-child {
  text-align: left;
}
th {
  font-weight: 600;
  color: #ddd;
  white-space: nowrap;
}
.u-name {
  font-weight: 600;
}
.u-email {
  color: #aaa;
  font-size: 0.85rem;
}
.cell input {
  width: 18px;
  height: 18px;
  accent-color: #c25fff;
  cursor: pointer;
}
.cell input:disabled {
  cursor: not-allowed;
}
</style>
