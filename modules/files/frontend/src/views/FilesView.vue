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
.tabs { display: flex; justify-content: center; gap: 0.5rem; padding: 0.8rem 1rem 0; }
.tab { background: none; border: none; color: #aaa; font-size: 1rem; padding: 0.5rem 1.2rem; border-bottom: 2px solid transparent; cursor: pointer; transition: color 0.2s, border-color 0.2s; }
.tab:hover { color: #fff; }
.tab.active { color: var(--mp-accent); border-color: var(--mp-accent); }
.body { flex: 1; min-height: 0; overflow: auto; }
.body > :first-child { height: 100%; }
</style>
