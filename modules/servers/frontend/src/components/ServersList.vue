<template>
  <div class="servers-list">
    <h1 class="themed-h1 servers-title">Serveurs de jeu</h1>

    <p v-if="loading" class="empty">Chargement...</p>

    <p v-else-if="servers.length === 0 && !error" class="empty">
      <template v-if="session.isAdmin">
        Aucun serveur déclaré. Ajoutez-en dans l'onglet « Gestion ».
      </template>
      <template v-else>
        Aucun serveur ne vous est attribué. Demandez l'accès à un administrateur.
      </template>
    </p>

    <div v-else class="grid">
      <ServerCard
        v-for="s in servers"
        :key="s.server_id"
        :server="s"
        :busy="busy[s.server_id] ?? ''"
        :now="now"
        @toggle="toggle"
        @restart="restart"
      />
    </div>

    <p v-if="error" class="form-error">{{ error }}</p>
  </div>
  <Toast ref="toastRef" />
</template>

<script setup>
import { ref } from 'vue'
import { Toast } from '@myprout/ui'
import { useServers } from '@/composables/useServers'
import { useSession } from '@/stores/session'
import ServerCard from './ServerCard.vue'

const session = useSession()
const toastRef = ref(null)
const { servers, loading, error, busy, now, run } = useServers()

async function act(server, action) {
  const message = await run(server, action)
  if (message) toastRef.value?.show(message)
}

function toggle(server) {
  if (server.running) {
    if (!confirm(`Éteindre « ${server.name} » ? Les joueurs connectés seront déconnectés.`)) return
    return act(server, 'stop')
  }
  return act(server, 'start')
}

function restart(server) {
  if (!confirm(`Redémarrer « ${server.name} » ? Les joueurs connectés seront déconnectés.`)) return
  return act(server, 'restart')
}
</script>

<style scoped>
.servers-list { max-width: 900px; margin: 0 auto; padding: 1rem; }
.servers-title { text-align: center; }
.empty { color: #aaa; text-align: center; margin-top: 3rem; line-height: 1.6; }
.grid { display: flex; flex-direction: column; gap: 1rem; margin-top: 1.5rem; }
</style>
