<template>
  <div
    class="browser"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent
    @dragleave="onDragLeave"
    @drop.prevent="onDropFiles"
  >
    <header class="head">
      <h1 class="themed-h1 title">{{ trashMode ? 'Corbeille' : 'Mes fichiers' }}</h1>
      <QuotaBar :usage="usage" />
    </header>

    <div class="toolbar">
      <nav v-if="!trashMode" class="crumbs" aria-label="Chemin">
        <button class="crumb" :class="{ over: overId === 'root' }" @click="goTo(null)"
          @dragover="onCrumbOver($event, 'root')" @dragleave="overId = null" @drop.prevent.stop="onMoveDrop(null)">
          <span class="material-icons">home</span>
        </button>
        <template v-for="c in path" :key="c.node_id">
          <span class="sep">/</span>
          <button class="crumb" :class="{ over: overId === c.node_id }" @click="goTo(c.node_id)"
            @dragover="onCrumbOver($event, c.node_id)" @dragleave="overId = null" @drop.prevent.stop="onMoveDrop(c.node_id)">
            <span v-if="c.is_vault || c.encrypted" class="material-icons lock">lock</span>{{ c.label }}
          </button>
        </template>
      </nav>
      <p v-else class="crumbs note">
        Les éléments supprimés restent {{ retentionDays }} jours, puis sont effacés définitivement. Ils comptent dans votre quota.
      </p>

      <input v-if="!trashMode" class="themed-input search" v-model="query" type="search" :placeholder="inVault ? 'Filtrer ce coffre...' : 'Rechercher...'" />

      <template v-if="!trashMode">
        <button class="themed-button button-secondary tool" @click="trash()" title="Corbeille">
          <span class="material-icons">delete_outline</span><span class="tool-label">Corbeille</span>
        </button>
        <button v-if="currentId === null && !searching" class="themed-button button-secondary tool" @click="vaultModal = true" title="Dossier chiffré">
          <span class="material-icons">lock</span><span class="tool-label">Coffre</span>
        </button>
        <button class="themed-button button-secondary tool" @click="folderModal = true" :disabled="searching">
          <span class="material-icons">create_new_folder</span><span class="tool-label">Dossier</span>
        </button>
        <button class="themed-button button-primary tool" @click="picker.click()">
          <span class="material-icons">upload</span><span class="tool-label">Téléverser</span>
        </button>
        <input ref="picker" type="file" multiple hidden @change="onPick" />
      </template>
      <template v-else>
        <button class="themed-button button-secondary tool" @click="goTo(currentId)">
          <span class="material-icons">arrow_back</span><span class="tool-label">Retour</span>
        </button>
        <button class="themed-button button-danger tool" :disabled="trashItems.length === 0" @click="onEmptyTrash">
          <span class="material-icons">delete_forever</span><span class="tool-label">Vider</span>
        </button>
      </template>
    </div>

    <p v-if="inVault && !trashMode" class="vault-banner">
      <span class="material-icons">lock</span>
      Coffre chiffré : noms et contenus sont chiffrés dans votre navigateur, le serveur ne peut pas les lire.
      Ni recherche serveur, ni aperçu instantané ; fichiers limités à {{ maxVaultMb }} Mo ; rien ne peut en sortir par déplacement.
    </p>

    <p v-if="error" class="form-error">{{ error }}</p>
    <div v-if="loading" class="state">Chargement...</div>
    <div v-else-if="visible.length === 0" class="state">
      <template v-if="trashMode">La corbeille est vide.</template>
      <template v-else-if="query.trim()">Aucun résultat pour « {{ query }} ».</template>
      <template v-else>Ce dossier est vide. Glissez des fichiers ici ou utilisez « Téléverser ».</template>
    </div>

    <div v-else class="list">
      <div class="row row-head">
        <span class="c-name">Nom</span><span class="c-size">Taille</span>
        <span class="c-date">{{ trashMode ? 'Suppression' : 'Modifié' }}</span><span class="c-actions" />
      </div>

      <div
        v-for="n in visible" :key="n.node_id" class="row item"
        :class="{ over: overId === n.node_id, dragging: dragging?.node_id === n.node_id, trashed: trashMode }"
        :draggable="!trashMode"
        @dragstart="onDragStart($event, n)" @dragend="dragging = null; overId = null"
        @dragover="n.is_folder && onFolderOver($event, n)" @dragleave="overId = null"
        @drop.prevent.stop="n.is_folder && onMoveDrop(n.node_id)"
        @click="!trashMode && onOpen(n)"
      >
        <span class="c-name">
          <span class="material-icons kind" :class="{ folder: n.is_folder, vault: n.encrypted }">{{ iconFor(n) }}</span>
          <span class="name" :title="n.label">{{ n.label }}</span>
          <span v-if="n.encrypted && !n.is_vault" class="material-icons mini-lock" title="Chiffré">lock</span>
        </span>
        <span class="c-size">{{ n.is_folder ? '' : formatBytes(n.display_size) }}</span>
        <span class="c-date">
          <template v-if="trashMode">{{ formatDate(n.trashed_at) }}<br /><small>efface dans {{ daysLeft(n.expires_at) }} j</small></template>
          <template v-else>{{ formatDate(n.updated_at ?? n.created_at) }}</template>
        </span>
        <span class="c-actions">
          <template v-if="trashMode">
            <button class="act" title="Restaurer" @click.stop="onRestore(n)"><span class="material-icons">restore_from_trash</span></button>
            <button class="act danger" title="Supprimer définitivement" @click.stop="onDeleteForever(n)"><span class="material-icons">delete_forever</span></button>
          </template>
          <template v-else>
            <button v-if="searching && n.parent_id !== null" class="act" title="Ouvrir le dossier" @click.stop="goTo(n.parent_id)"><span class="material-icons">folder_open</span></button>
            <button v-if="!n.is_folder" class="act" title="Télécharger" @click.stop="onDownload(n)"><span class="material-icons">download</span></button>
            <button class="act" title="Renommer" @click.stop="renaming = n"><span class="material-icons">edit</span></button>
            <button class="act danger" title="Mettre à la corbeille" @click.stop="onDelete(n)"><span class="material-icons">delete</span></button>
          </template>
        </span>
      </div>
    </div>

    <div v-if="fileDrag && !trashMode" class="drop-overlay">
      <span class="material-icons">cloud_upload</span>
      {{ inVault ? 'Déposez pour envoyer (chiffrés) dans ce coffre' : 'Déposez vos fichiers pour les envoyer ici' }}
    </div>

    <UploadPanel :uploads="uploads" @cancel="cancelUpload" @clear="clearFinishedUploads" />
    <Toast ref="toast" />

    <PromptModal v-if="folderModal" title="Nouveau dossier" label="Nom du dossier" confirm-text="Créer"
      :loading="busy" :error="modalError" @close="closeModals" @submit="onCreateFolder" />
    <PromptModal v-if="vaultModal" title="Nouveau coffre chiffré" label="Nom du coffre" confirm-text="Créer le coffre"
      hint="Tout ce que contient un coffre (noms, dossiers, fichiers) est chiffré dans votre navigateur avec une clé liée à votre mot de passe. Si vous perdez à la fois votre mot de passe et vos réponses de sécurité, son contenu est définitivement perdu."
      :loading="busy" :error="modalError" @close="closeModals" @submit="onCreateVault" />
    <PromptModal v-if="renaming" title="Renommer" label="Nouveau nom" :initial="renaming.label" confirm-text="Renommer"
      :loading="busy" :error="modalError" @close="closeModals" @submit="onRename" />
    <PromptModal v-if="restoreRename" title="Restaurer sous un autre nom" label="Nom" :initial="restoreRename.label" confirm-text="Restaurer"
      hint="Un élément porte déjà ce nom à l'emplacement d'origine."
      :loading="busy" :error="modalError" @close="closeModals" @submit="onRestoreRenamed" />
    <PreviewModal v-if="preview" :node="preview.node" :url="preview.url" @close="closePreview" />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Toast } from '@myprout/ui'
import { errorCode, errorMessage, useFiles } from '@/composables/useFiles'
import { daysLeft, formatBytes, formatDate, iconFor, isPreviewable } from '@/utils/format'
import { MAX_VAULT_FILE } from '@/utils/vault'
import QuotaBar from './QuotaBar.vue'
import PromptModal from './PromptModal.vue'
import PreviewModal from './PreviewModal.vue'
import UploadPanel from './UploadPanel.vue'

const {
  items, path, currentId, inVault, loading, error, usage, searching, uploads, trashMode, trashItems, retentionDays,
  loadVaults, refreshUsage, open, search, createFolder, createVault, rename, move, remove,
  download, previewSource, openTrash, restore, deleteForever, emptyTrash,
  upload, cancelUpload, clearFinishedUploads,
} = useFiles()

const maxVaultMb = Math.round(MAX_VAULT_FILE / 1048576)
const toast = ref(null)
const picker = ref(null)
const query = ref('')
const folderModal = ref(false)
const vaultModal = ref(false)
const renaming = ref(null)
const restoreRename = ref(null)
const preview = ref(null)
const busy = ref(false)
const modalError = ref('')

onMounted(async () => {
  await loadVaults() // les clés doivent être prêtes avant d'afficher des noms chiffrés
  open(null)
  refreshUsage()
})
onBeforeUnmount(() => preview.value?.revoke())

// Dans un coffre le filtrage se fait ici (le serveur ne voit pas les noms) ; ailleurs, recherche serveur
const visible = computed(() => {
  if (trashMode.value) return trashItems.value
  const q = query.value.trim().toLowerCase()
  return inVault.value && q ? items.value.filter((i) => i.label.toLowerCase().includes(q)) : items.value
})

const notify = (e) => toast.value?.show(errorMessage(e))

// ─── Navigation & recherche ───
function goTo(id) {
  query.value = ''
  open(id)
}
const trash = () => {
  query.value = ''
  openTrash()
}

let searchTimer
watch(query, (q) => {
  if (inVault.value) return
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    if (q.trim().length >= 2) search(q.trim())
    else if (searching.value) open(currentId.value)
  }, 300)
})

async function onOpen(n) {
  if (n.is_folder) return goTo(n.node_id)
  if (!isPreviewable(n)) return onDownload(n)
  try {
    if (n.encrypted) toast.value?.show('Déchiffrement...')
    preview.value = { node: n, ...(await previewSource(n)) }
  } catch (e) {
    notify(e)
  }
}

function closePreview() {
  preview.value?.revoke()
  preview.value = null
}

async function onDownload(n) {
  try {
    if (n.encrypted) toast.value?.show('Déchiffrement...')
    await download(n)
  } catch (e) {
    notify(e)
  }
}

// ─── Actions ───
function closeModals() {
  folderModal.value = vaultModal.value = false
  renaming.value = restoreRename.value = null
  modalError.value = ''
}

async function runModal(fn, done) {
  busy.value = true
  modalError.value = ''
  try {
    await fn()
    closeModals()
    toast.value?.show(done)
  } catch (e) {
    modalError.value = errorMessage(e)
  } finally {
    busy.value = false
  }
}

const onCreateFolder = (name) => runModal(() => createFolder(name), 'Dossier créé')
const onCreateVault = (name) => runModal(() => createVault(name), 'Coffre créé')
const onRename = (name) => runModal(() => rename(renaming.value, name), 'Renommé')

async function onDelete(n) {
  const what = n.is_folder ? `le dossier « ${n.label} » et son contenu` : `« ${n.label} »`
  if (!confirm(`Mettre ${what} à la corbeille ? Il y restera ${retentionDays.value} jours.`)) return
  try {
    await remove(n)
    toast.value?.show('Déplacé dans la corbeille')
  } catch (e) {
    notify(e)
  }
}

// ─── Corbeille ───
async function onRestore(n) {
  try {
    await restore(n)
    toast.value?.show('Restauré')
  } catch (e) {
    if (errorCode(e) === 'NAME_EXISTS') restoreRename.value = n // coffre : seul le client peut chiffrer un nouveau nom
    else notify(e)
  }
}
const onRestoreRenamed = (name) => runModal(() => restore(restoreRename.value, name), 'Restauré')

async function onDeleteForever(n) {
  if (!confirm(`Supprimer définitivement « ${n.label} » ? Cette action est irréversible.`)) return
  try {
    await deleteForever(n)
    toast.value?.show('Supprimé définitivement')
  } catch (e) {
    notify(e)
  }
}

async function onEmptyTrash() {
  if (!confirm('Vider la corbeille ? Tout sera supprimé définitivement.')) return
  try {
    await emptyTrash()
    toast.value?.show('Corbeille vidée')
  } catch (e) {
    notify(e)
  }
}

// ─── Envoi : bouton et glisser-déposer depuis le poste ───
function onPick(e) {
  upload([...e.target.files])
  e.target.value = ''
}

const fileDrag = ref(false)
let depth = 0
const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes('Files')

function onDragEnter(e) {
  if (!hasFiles(e)) return
  depth++
  fileDrag.value = true
}
function onDragLeave(e) {
  if (!hasFiles(e)) return
  depth = Math.max(0, depth - 1)
  if (depth === 0) fileDrag.value = false
}
function onDropFiles(e) {
  depth = 0
  fileDrag.value = false
  if (trashMode.value) return
  if (searching.value) return toast.value?.show('Ouvrez un dossier pour y envoyer des fichiers')
  if (e.dataTransfer?.files?.length) upload([...e.dataTransfer.files])
}

// ─── Déplacement par glisser-déposer (élément -> dossier ou fil d'Ariane) ───
const dragging = ref(null)
const overId = ref(null)

function onDragStart(e, n) {
  if (trashMode.value || n.is_vault) return e.preventDefault() // un coffre reste à la racine
  dragging.value = n
  e.dataTransfer.effectAllowed = 'move'
  e.dataTransfer.setData('text/plain', n.label)
}
function onFolderOver(e, n) {
  if (!dragging.value || dragging.value.node_id === n.node_id) return
  e.preventDefault()
  overId.value = n.node_id
}
function onCrumbOver(e, id) {
  if (!dragging.value) return
  e.preventDefault()
  overId.value = id
}
async function onMoveDrop(targetId) {
  const node = dragging.value
  dragging.value = null
  overId.value = null
  if (!node || node.node_id === targetId) return
  try {
    await move(node, targetId)
    toast.value?.show('Déplacé')
  } catch (e) {
    notify(e)
  }
}
</script>

<style scoped>
.browser { position: relative; display: flex; flex-direction: column; height: 100%; padding: 1rem; box-sizing: border-box; overflow: hidden; }
.head { display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; margin-bottom: 1rem; }
.title { margin: 0; }
.toolbar { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; margin-bottom: 1rem; }
.crumbs { flex: 1; min-width: 200px; display: flex; align-items: center; flex-wrap: wrap; gap: 2px; margin: 0; }
.crumbs.note { color: var(--mp-muted); font-size: 0.85rem; }
.crumb { background: none; border: 1px solid transparent; color: #fff; border-radius: 8px; padding: 4px 8px; cursor: pointer; display: flex; align-items: center; gap: 4px; font-size: 0.95rem; }
.crumb:hover, .crumb.over { color: var(--mp-accent); border-color: var(--mp-accent); }
.crumb .lock { font-size: 1rem; color: var(--mp-accent); }
.sep { color: var(--mp-muted); }
.search { width: 220px; margin: 0; }
.tool { width: auto; gap: 0.4rem; padding: 10px 16px; font-size: 0.95rem; }
.tool:disabled { opacity: 0.4; cursor: not-allowed; }
.tool .material-icons { font-size: 1.2rem; }

.vault-banner { display: flex; gap: 0.6rem; align-items: flex-start; font-size: 0.82rem; line-height: 1.4; color: #ddd; background: rgba(194, 95, 255, 0.1); border: 1px solid rgba(194, 95, 255, 0.35); border-radius: 10px; padding: 0.6rem 0.9rem; margin: 0 0 0.8rem; }
.vault-banner .material-icons { font-size: 1.1rem; color: var(--mp-accent); }

.state { text-align: center; color: var(--mp-muted); margin-top: 3rem; }
.list { flex: 1; min-height: 0; overflow-y: auto; }
.row { display: grid; grid-template-columns: minmax(0, 1fr) 110px 150px 140px; align-items: center; gap: 1rem; padding: 0.55rem 0.8rem; border-radius: 10px; }
.row-head { color: var(--mp-muted); font-size: 0.8rem; position: sticky; top: 0; background: #000; z-index: 1; }
.item { cursor: pointer; border: 1px solid transparent; }
.item.trashed { cursor: default; }
.item:hover { background: var(--mp-input-bg); }
.item.over { border-color: var(--mp-accent); background: rgba(194, 95, 255, 0.12); }
.item.dragging { opacity: 0.4; }
.c-name { display: flex; align-items: center; gap: 0.7rem; min-width: 0; }
.name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kind { color: var(--mp-muted); }
.kind.folder { color: var(--mp-highlight); }
.kind.vault { color: var(--mp-accent); }
.mini-lock { font-size: 0.9rem; color: var(--mp-accent); opacity: 0.8; }
.c-size, .c-date { font-size: 0.85rem; color: var(--mp-muted); }
.c-date small { font-size: 0.75rem; }
.c-actions { display: flex; justify-content: flex-end; gap: 4px; opacity: 0; transition: opacity 0.15s; }
.item:hover .c-actions, .item:focus-within .c-actions { opacity: 1; }
.act { background: transparent; border: 1px solid #444; border-radius: 6px; color: #ccc; cursor: pointer; padding: 3px; display: flex; }
.act .material-icons { font-size: 1.15rem; }
.act:hover { border-color: var(--mp-accent); color: var(--mp-accent); }
.act.danger:hover { border-color: #ff5555; color: #ff5555; }

.drop-overlay { position: absolute; inset: 0; z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; font-size: 1.2rem; background: rgba(0, 0, 0, 0.82); border: 2px dashed var(--mp-accent); border-radius: 22px; pointer-events: none; }
.drop-overlay .material-icons { font-size: 3rem; color: var(--mp-accent); }

@media (max-width: 800px) {
  .row { grid-template-columns: minmax(0, 1fr) 80px; }
  .c-date, .row-head .c-actions { display: none; }
  .c-actions { opacity: 1; grid-column: 1 / -1; justify-content: flex-start; }
  .tool-label { display: none; }
  .head { gap: 1rem; }
}
@media (hover: none) { .c-actions { opacity: 1; } }
</style>
