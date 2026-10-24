<template>
  <div class="themed-card admin-page">
    <div class="admin-tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="admin-tab"
        :class="{ active: tab === t.id }"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>
    <div class="admin-body">
      <PendingUsers v-if="tab === 'pending'" />
      <UsersAccess v-else-if="tab === 'users'" />
      <ModulesAdmin v-else />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import PendingUsers from '@/components/admin/PendingUsers.vue'
import UsersAccess from '@/components/admin/UsersAccess.vue'
import ModulesAdmin from '@/components/admin/ModulesAdmin.vue'

const tab = ref('pending')
const tabs = [
  { id: 'pending', label: 'Inscriptions' },
  { id: 'users', label: 'Utilisateurs' },
  { id: 'modules', label: 'Modules' },
]
</script>

<style scoped>
.admin-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.admin-tabs {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 1rem 0;
}
.admin-tab {
  background: none;
  border: none;
  color: #aaa;
  font-size: 1rem;
  padding: 0.6rem 1.2rem;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}
.admin-tab:hover { color: #fff; }
.admin-tab.active { color: var(--mp-accent); border-color: var(--mp-accent); }
.admin-body { flex: 1; min-height: 0; overflow: auto; padding: 1rem; }
</style>
