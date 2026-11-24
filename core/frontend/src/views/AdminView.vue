<template>
  <div class="admin-page">
    <h1 class="themed-h1">Administration</h1>
    <div class="admin-tabs" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="admin-tab"
        role="tab"
        :aria-selected="tab === t.id"
        :class="{ active: tab === t.id }"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>
    <div class="themed-card admin-body">
      <PendingUsers v-if="tab === 'pending'" />
      <UsersAccess v-else-if="tab === 'users'" />
      <UsersRoles v-else-if="tab === 'roles'" />
      <RolesAdmin v-else-if="tab === 'rights'" />
      <ModulesAdmin v-else />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import PendingUsers from '@/components/admin/PendingUsers.vue'
import UsersAccess from '@/components/admin/UsersAccess.vue'
import ModulesAdmin from '@/components/admin/ModulesAdmin.vue'
import UsersRoles from '@/components/admin/UsersRoles.vue'
import RolesAdmin from '@/components/admin/RolesAdmin.vue'

const tab = ref('pending')
const tabs = [
  { id: 'pending', label: 'Inscriptions' },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'roles', label: 'Rôles' },
  { id: 'rights', label: 'Droits des rôles' },
  { id: 'modules', label: 'Modules' },
]
</script>

<style scoped>
.admin-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.admin-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}
.admin-tab {
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid transparent;
  background: none;
  color: var(--mp-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.15s,
    background-color 0.15s;
}
.admin-tab:hover {
  color: #fff;
}
.admin-tab.active {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--mp-glass-border);
  color: #fff;
}
.admin-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 24px;
}
</style>
