import { ref, onMounted, onUnmounted } from 'vue'
import api from '@/services/api'

const POLL_MS = 5000

export function useServers() {
  const servers = ref([])
  const loading = ref(true)
  const error = ref('')
  const busy = ref({}) // { server_id: 'start' | 'stop' | 'restart' } : action en cours
  const now = ref(Date.now()) // sert au calcul de la durée de fonctionnement
  let timer = null

  async function refresh() {
    try {
      const { data } = await api.get('/')
      servers.value = data
      error.value = ''
    } catch (e) {
      error.value = e.response?.data?.error ?? 'Impossible de charger les serveurs'
    } finally {
      loading.value = false
      now.value = Date.now()
    }
  }

  // Renvoie un message de succès (ou lève l'erreur affichée par la vue)
  async function run(server, action) {
    busy.value[server.server_id] = action
    error.value = ''
    try {
      const { data } = await api.post(`/${server.server_id}/${action}`)
      const i = servers.value.findIndex((s) => s.server_id === data.server_id)
      if (i !== -1) servers.value[i] = data
      return { start: 'Serveur démarré', stop: 'Serveur éteint', restart: 'Serveur redémarré' }[action]
    } catch (e) {
      error.value = e.response?.data?.error ?? 'Action impossible'
      await refresh()
      return null
    } finally {
      delete busy.value[server.server_id]
    }
  }

  onMounted(() => {
    refresh()
    timer = setInterval(() => {
      if (!document.hidden) refresh()
    }, POLL_MS)
  })
  onUnmounted(() => clearInterval(timer))

  return { servers, loading, error, busy, now, run, refresh }
}
