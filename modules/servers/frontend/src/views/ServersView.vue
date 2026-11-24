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
.tabs { display: flex; flex-wrap: wrap; gap: 6px; padding: 16px 20px 0; }
.tab { min-height: 40px; padding: 0 16px; border-radius: 999px; border: 1px solid transparent; background: none; color: var(--mp-muted); font-size: 14px; font-weight: 500; cursor: pointer; transition: color 0.15s, background-color 0.15s; }
.tab:hover { color: #fff; }
.tab.active { background: rgba(255, 255, 255, 0.1); border-color: var(--mp-glass-border); color: #fff; }
.body { flex: 1; min-height: 0; overflow: auto; padding: 1rem; }
</style>
