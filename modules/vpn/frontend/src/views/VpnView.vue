<template>
  <div v-if="forbidden" class="themed-card no-access">
    <h2 class="themed-h2">Accès réservé</h2>
    <p>Le VPN est réservé aux membres de la famille. Contactez un administrateur.</p>
    <a href="/" class="themed-button button-primary">Retour à l'accueil</a>
  </div>

  <div v-else class="themed-card vpn-page">
    <div class="vpn-header">
      <h1 class="themed-h1 vpn-title">
        Mon VPN ({{ devices.length }}/{{ info?.max_devices ?? '–' }})
      </h1>
      <button class="themed-button button-primary add-btn" :disabled="!canAdd" @click="openCreate">
        Ajouter un appareil +
      </button>
    </div>

    <p class="vpn-intro">
      Le trafic de vos appareils passe par le serveur Myprout en France avant d'atteindre Internet :
      les sites vous voient depuis l'adresse du serveur. Installez l'application
      <strong>WireGuard</strong> sur l'appareil, puis ajoutez-le ici pour obtenir sa configuration.
    </p>

    <p v-if="loadError" class="form-error">{{ loadError }}</p>
    <div v-if="loading" class="empty">Chargement...</div>
    <div v-else-if="devices.length === 0 && !loadError" class="empty">
      Aucun appareil. Ajoutez le premier pour activer le VPN.
    </div>

    <div v-else class="devices">
      <div v-for="d in devices" :key="d.device_id" class="device">
        <span class="material-icons device-icon">devices</span>

        <div class="device-info">
          <span class="device-name">{{ d.name }}</span>
          <span class="device-meta">{{ d.ip }}</span>
        </div>

        <div class="device-state">
          <span class="badge" :class="stateOf(d).kind">{{ stateOf(d).label }}</span>
          <span v-if="d.status && d.is_enabled" class="device-meta">
            ↓ {{ bytes(d.status.tx) }} · ↑ {{ bytes(d.status.rx) }}
          </span>
        </div>

        <div class="device-actions">
          <button class="btn-action" title="Afficher la configuration" @click="openConfig(d)">
            <span class="material-icons">qr_code_2</span>
          </button>
          <button class="btn-action btn-delete" title="Supprimer" @click="remove(d)">
            <span class="material-icons">delete</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <Toast ref="toastRef" />

  <DeviceModal
    v-if="showModal"
    :config="modalConfig"
    :name="modalName"
    :loading="creating"
    :error="modalError"
    :note="modalNote"
    @close="closeModal"
    @submit="createDevice"
  />
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Toast } from '@myprout/ui'
import api from '@/services/api'
import { useSession } from '@/stores/session'
import { decryptText, encryptText } from '@/utils/crypto'
import { buildConfig, generateKeypair } from '@/utils/wireguard'
import DeviceModal from '@/components/DeviceModal.vue'

const session = useSession()
const toastRef = ref(null)

const devices = ref([])
const info = ref(null)
const loading = ref(true)
const loadError = ref('')
const forbidden = ref(false)

const showModal = ref(false)
const creating = ref(false)
const modalConfig = ref('')
const modalName = ref('')
const modalError = ref('')
const modalNote = ref('')

const canAdd = computed(
  () => info.value && devices.value.length < info.value.max_devices
)

// ─── Chargement ──────────────────────────────────────────────────────────────
async function refresh() {
  try {
    devices.value = (await api.get('/devices')).data
  } catch (e) {
    if (loading.value) loadError.value = e.response?.data?.error ?? 'Chargement impossible'
  }
}

let timer = null
onMounted(async () => {
  try {
    info.value = (await api.get('/info')).data
  } catch (e) {
    if (e.response?.status === 403) {
      forbidden.value = true // module visible (rôle « tous les modules ») mais VPN réservé à la famille
      loading.value = false
      return
    }
    loadError.value = e.response?.data?.error ?? 'Le serveur VPN est indisponible'
  }
  await refresh()
  loading.value = false
  timer = setInterval(refresh, 15000) // état de connexion à jour
})
onUnmounted(() => clearInterval(timer))

// ─── Affichage ───────────────────────────────────────────────────────────────
const bytes = (n) => {
  if (n < 1024) return `${n} o`
  const units = ['Ko', 'Mo', 'Go', 'To']
  let i = -1
  do {
    n /= 1024
    i++
  } while (n >= 1024 && i < units.length - 1)
  return `${n.toFixed(n < 10 ? 1 : 0)} ${units[i]}`
}

const ago = (epochSeconds) => {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - epochSeconds))
  if (s < 60) return 'à l\'instant'
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  return `il y a ${Math.floor(s / 86400)} j`
}

function stateOf(d) {
  if (!d.is_enabled) return { kind: 'off', label: 'Suspendu (accès retiré)' }
  if (!d.status) return { kind: 'idle', label: 'État inconnu' }
  if (d.status.connected) return { kind: 'on', label: 'Connecté' }
  if (d.status.last_handshake) {
    return { kind: 'idle', label: `Dernière connexion ${ago(d.status.last_handshake)}` }
  }
  return { kind: 'idle', label: 'Jamais connecté' }
}

// ─── Création ────────────────────────────────────────────────────────────────
function openCreate() {
  modalConfig.value = ''
  modalName.value = ''
  modalError.value = ''
  modalNote.value = ''
  showModal.value = true
}

function closeModal() {
  showModal.value = false
  modalConfig.value = '' // la clé privée ne reste pas en mémoire de l'interface
}

async function createDevice(name) {
  creating.value = true
  modalError.value = ''
  try {
    // 1. La paire de clés est créée ici ; seule la clé publique part au serveur
    const { privateKey, publicKey } = await generateKeypair()
    const { data } = await api.post('/devices', { name, public_key: publicKey })

    // 2. Le serveur a attribué une IP : on assemble la configuration
    const config = buildConfig({
      privateKey,
      address: data.device.ip,
      dns: data.server.dns,
      serverPublicKey: data.server.server_public_key,
      endpoint: data.server.endpoint,
    })

    // 3. Copie chiffrée (clé du module) pour pouvoir la ré-afficher plus tard
    try {
      await api.put(`/devices/${data.device.device_id}/config`, {
        encrypted_config: await encryptText(config, session.moduleKey),
      })
    } catch {
      modalNote.value =
        'La configuration n\'a pas pu être sauvegardée : importez-la maintenant, vous ne pourrez pas la ré-afficher.'
    }

    modalName.value = name
    modalConfig.value = config
    await refresh()
  } catch (e) {
    modalError.value =
      e.name === 'NotSupportedError'
        ? 'Ce navigateur ne sait pas générer de clés WireGuard (X25519). Utilisez une version récente de Chrome, Firefox ou Safari.'
        : (e.response?.data?.error ?? 'Erreur lors de la création')
  } finally {
    creating.value = false
  }
}

// ─── Configuration existante / suppression ───────────────────────────────────
async function openConfig(d) {
  if (!d.encrypted_config) {
    toastRef.value?.show('Configuration indisponible : recréez l\'appareil')
    return
  }
  try {
    modalConfig.value = await decryptText(d.encrypted_config, session.moduleKey)
    modalName.value = d.name
    modalError.value = ''
    modalNote.value = ''
    showModal.value = true
  } catch {
    toastRef.value?.show('Déchiffrement impossible')
  }
}

async function remove(d) {
  if (!confirm(`Supprimer « ${d.name} » ? L'appareil sera déconnecté immédiatement.`)) return
  try {
    await api.delete(`/devices/${d.device_id}`)
    devices.value = devices.value.filter((x) => x.device_id !== d.device_id)
    toastRef.value?.show('Appareil supprimé')
  } catch (e) {
    toastRef.value?.show(e.response?.data?.error ?? 'Suppression impossible')
  }
}
</script>

<style scoped>
.no-access {
  max-width: 420px;
  margin: 4rem auto;
  padding: 2rem;
  text-align: center;
}
.no-access a {
  text-decoration: none;
  margin-top: 1.5rem;
  box-sizing: border-box;
}
.vpn-page {
  height: 100%;
  overflow: auto;
  padding: 1rem 1.5rem;
  box-sizing: border-box;
}
.vpn-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0 0;
}
.vpn-title {
  flex: 1;
}
.add-btn {
  flex: 0 0 auto;
  width: auto;
  padding: 12px 22px;
}
.vpn-intro {
  color: #aaa;
  font-size: 0.9rem;
  line-height: 1.6;
  max-width: 70ch;
  margin: 0 0 1.5rem;
}
.empty {
  text-align: center;
  color: #aaa;
  margin-top: 3rem;
  font-size: 1.1rem;
}
.devices {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.device {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  padding: 0.9rem 1.2rem;
  border-radius: 10px;
  background: #1e1e2e;
  border: 1px solid #2e2e3e;
}
.device-icon {
  font-size: 1.8rem;
  color: var(--mp-accent);
}
.device-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
}
.device-name {
  font-weight: 600;
  font-size: 1.1rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.device-meta {
  color: #888;
  font-size: 0.8rem;
}
.device-state {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}
.badge {
  font-size: 0.78rem;
  padding: 2px 10px;
  border-radius: 10px;
  white-space: nowrap;
}
.badge.on {
  background: color-mix(in srgb, var(--mp-success) 20%, transparent);
  color: var(--mp-success);
}
.badge.idle {
  background: #2a2a38;
  color: #aaa;
}
.badge.off {
  background: color-mix(in srgb, var(--mp-danger) 18%, transparent);
  color: var(--mp-danger);
}
.device-actions {
  display: flex;
  gap: 0.5rem;
}
.btn-action {
  background: transparent;
  border: 1px solid #444;
  border-radius: 6px;
  color: #ccc;
  cursor: pointer;
  padding: 0.3rem;
  transition: all 0.2s;
  display: flex;
  align-items: center;
}
.btn-action:hover {
  border-color: var(--mp-accent);
  color: var(--mp-accent);
}
.btn-delete:hover {
  border-color: #ff5555;
  color: #ff5555;
}
@media (max-width: 700px) {
  .vpn-header {
    flex-direction: column;
    align-items: stretch;
  }
  .device {
    flex-wrap: wrap;
  }
  .device-state {
    align-items: flex-start;
  }
}
</style>
