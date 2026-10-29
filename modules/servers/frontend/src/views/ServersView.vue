<template>
  <div class="themed-card servers-page">
    <div v-if="session.isAdmin" class="tabs">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="tab"
        :class="{ active: tab === t.id }"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>
    <div class="body">
      <ServersAdmin v-if="tab === 'admin' && session.isAdmin" />
      <ServersList v-else />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useSession } from '@/stores/session'
import ServersList from '@/components/ServersList.vue'
import ServersAdmin from '@/components/ServersAdmin.vue'

const session = useSession()
const tab = ref('list')
const tabs = [
  { id: 'list', label: 'Serveurs' },
  { id: 'admin', label: 'Gestion' },
]
</script>

<style scoped>
.servers-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.tabs {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 1rem 0;
}
.tab {
  background: none;
  border: none;
  color: #aaa;
  font-size: 1rem;
  padding: 0.6rem 1.2rem;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
}
.tab:hover { color: #fff; }
.tab.active { color: var(--mp-accent); border-color: var(--mp-accent); }
.body { flex: 1; min-height: 0; overflow: auto; padding: 1rem; }
</style>
