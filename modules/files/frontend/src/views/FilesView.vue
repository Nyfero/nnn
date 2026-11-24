<template>
  <div class="themed-card files-page">
    <div v-if="session.isAdmin" class="tabs">
      <button class="tab" :class="{ active: tab === 'files' }" @click="tab = 'files'">Mes fichiers</button>
      <button class="tab" :class="{ active: tab === 'quotas' }" @click="tab = 'quotas'">Espace et quotas</button>
    </div>
    <div class="body">
      <FileBrowser v-show="tab === 'files'" />
      <QuotaAdmin v-if="tab === 'quotas'" />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useSession } from '@/stores/session'
import FileBrowser from '@/components/FileBrowser.vue'
import QuotaAdmin from '@/components/QuotaAdmin.vue'

const session = useSession()
const tab = ref('files')
</script>

<style scoped>
.files-page { height: 100%; display: flex; flex-direction: column; overflow: hidden; }
.tabs { display: flex; flex-wrap: wrap; gap: 6px; padding: 16px 20px 0; }
.tab { min-height: 40px; padding: 0 16px; border-radius: 999px; border: 1px solid transparent; background: none; color: var(--mp-muted); font-size: 14px; font-weight: 500; cursor: pointer; transition: color 0.15s, background-color 0.15s; }
.tab:hover { color: #fff; }
.tab.active { background: rgba(255, 255, 255, 0.1); border-color: var(--mp-glass-border); color: #fff; }
.body { flex: 1; min-height: 0; overflow: auto; }
.body > :first-child { height: 100%; }
</style>
