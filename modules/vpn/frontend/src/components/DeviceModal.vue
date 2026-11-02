<template>
  <BaseModal @close="$emit('close')">
    <template #header>
      <div class="modal-header-empty" />
      <div class="modal-header-title">
        <h2 class="themed-h2">{{ config ? name : 'Nouvel appareil' }}</h2>
      </div>
      <div class="modal-header-actions">
        <button class="modal-close" @click="$emit('close')" tabindex="-1">
          <span class="material-icons">close</span>
        </button>
      </div>
    </template>

    <!-- Étape 1 : nom de l'appareil -->
    <form v-if="!config" class="modal-form" @submit.prevent="submit">
      <div class="form-group">
        <label class="themed-label">Nom de l'appareil</label>
        <input
          class="themed-input"
          v-model="deviceName"
          type="text"
          maxlength="64"
          placeholder="Téléphone de Paul"
          autofocus
          required
        />
      </div>
      <p class="hint">
        Une clé de chiffrement propre à cet appareil est générée dans votre navigateur.
        Le serveur n'en reçoit que la partie publique.
      </p>
      <p v-if="error" class="form-error">{{ error }}</p>
      <button type="submit" hidden />
    </form>

    <!-- Étape 2 : configuration à importer dans l'application WireGuard -->
    <div v-else class="modal-form">
      <p class="hint">
        Dans l'application <strong>WireGuard</strong>, scannez ce code (téléphone) ou importez
        le fichier (ordinateur), puis activez le tunnel.
      </p>
      <img v-if="qr" :src="qr" alt="QR code de la configuration WireGuard" class="qr" />
      <pre class="config">{{ config }}</pre>
      <p class="hint warn">
        <span class="material-icons">lock</span>
        Cette configuration contient la clé privée de l'appareil : ne la partagez pas.
      </p>
      <p v-if="note" class="form-error">{{ note }}</p>
    </div>

    <template #footer>
      <div class="modal-footer-left"></div>
      <div class="modal-footer-right" v-if="!config">
        <button class="themed-button button-secondary" @click="$emit('close')">Annuler</button>
        <button class="themed-button button-primary" :disabled="loading || !deviceName.trim()" @click="submit">
          {{ loading ? 'Création...' : 'Créer l\'appareil' }}
        </button>
      </div>
      <div class="modal-footer-right" v-else>
        <button class="themed-button button-secondary" @click="copy">
          {{ copied ? 'Copié' : 'Copier' }}
        </button>
        <button class="themed-button button-primary" @click="download">Télécharger le fichier</button>
      </div>
    </template>
  </BaseModal>
</template>

<script setup>
import { ref, watch } from 'vue'
import QRCode from 'qrcode'
import { BaseModal } from '@myprout/ui'
import { configFileName } from '@/utils/wireguard'

const props = defineProps({
  config: { type: String, default: '' }, // vide : étape de création
  name: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  note: { type: String, default: '' },
})
const emit = defineEmits(['close', 'submit'])

const deviceName = ref('')
const qr = ref('')
const copied = ref(false)

watch(
  () => props.config,
  async (cfg) => {
    qr.value = cfg ? await QRCode.toDataURL(cfg, { margin: 2, width: 260 }) : ''
  },
  { immediate: true }
)

function submit() {
  const name = deviceName.value.trim()
  if (name && !props.loading) emit('submit', name)
}

async function copy() {
  try {
    await navigator.clipboard.writeText(props.config)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    /* presse-papiers indisponible : le texte reste sélectionnable */
  }
}

function download() {
  const url = URL.createObjectURL(new Blob([props.config], { type: 'text/plain' }))
  const link = document.createElement('a')
  link.href = url
  link.download = configFileName(props.name)
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.hint {
  font-size: 0.85rem;
  color: #aaa;
  line-height: 1.5;
  margin: 0;
}
.hint.warn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #f59e0b;
}
.hint .material-icons {
  font-size: 1.1rem;
}
.qr {
  display: block;
  margin: 0 auto;
  width: 220px;
  height: 220px;
  border-radius: 8px;
  background: #fff;
}
.config {
  margin: 0;
  padding: 0.8rem;
  max-height: 160px;
  overflow: auto;
  font-size: 0.72rem;
  line-height: 1.5;
  color: #ccc;
  background: var(--mp-input-bg);
  border-radius: 8px;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
