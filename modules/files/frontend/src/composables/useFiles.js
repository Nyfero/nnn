import { computed, reactive, ref } from 'vue'
import api from '@/services/api'
import { useSession } from '@/stores/session'
import { mimeFromName, numberedName } from '@/utils/format'
import {
  MAX_VAULT_FILE, createVaultSecret, decryptFile, decryptName, encryptFile, encryptedSize, openVault, plainSize, sealName,
} from '@/utils/vault'

const MAX_PARALLEL = 2

export const errorMessage = (e) => e.response?.data?.error ?? e.message ?? 'Une erreur est survenue'
export const errorCode = (e) => e.response?.data?.code

export function useFiles() {
  const session = useSession()
  const vaults = new Map() // vault_id -> { enc, idx } (clés déchiffrées, en mémoire seulement)

  const items = ref([])
  const path = ref([]) // fil d'Ariane [{ node_id, label }]
  const currentId = ref(null) // null = racine
  const currentFolder = ref(null)
  const loading = ref(true)
  const error = ref('')
  const usage = ref(null)
  const searching = ref(false)
  const uploads = ref([])

  const trashMode = ref(false)
  const trashItems = ref([])
  const retentionDays = ref(7)

  const inVault = computed(() => !!currentFolder.value?.encrypted)
  const currentVaultId = () => currentFolder.value?.vault_id ?? null

  // ─── Coffres : clés ───
  async function loadVaults() {
    try {
      for (const v of (await api.get('/vaults')).data) {
        if (!vaults.has(v.vault_id)) vaults.set(v.vault_id, await openVault(v.wrapped_key, session.moduleKey))
      }
    } catch {
      /* un coffre dont la clé est illisible s'affichera comme verrouillé */
    }
  }

  // nom saisi -> corps de requête ({ name } clair ou { name, name_key } chiffré selon la zone)
  async function naming(vaultId, label) {
    if (vaultId === null || vaultId === undefined) return { name: label }
    const vault = vaults.get(vaultId)
    if (!vault) throw new Error('Clé du coffre indisponible')
    return sealName(vault, label)
  }

  async function decorate(n) {
    if (!n.encrypted) return { ...n, label: n.name, display_size: n.size, display_mime: n.mime }
    const vault = vaults.get(n.vault_id)
    let label = '(illisible)'
    if (vault) {
      try {
        label = await decryptName(vault, n.name)
      } catch {
        /* nom altéré */
      }
    }
    return {
      ...n, label, locked: !vault,
      display_size: n.is_folder ? 0 : plainSize(n.size),
      display_mime: n.is_folder ? null : mimeFromName(label),
    }
  }

  const sortNodes = (list) =>
    list.sort((a, b) => b.is_folder - a.is_folder || a.label.localeCompare(b.label, 'fr', { numeric: true, sensitivity: 'base' }))

  // ─── Quota ───
  async function refreshUsage() {
    try {
      usage.value = (await api.get('/me')).data
    } catch {
      /* non bloquant */
    }
  }

  // ─── Navigation ───
  async function open(id = null, { silent = false } = {}) {
    if (!silent) loading.value = true
    error.value = ''
    trashMode.value = false
    try {
      const { data } = await api.get('/nodes', { params: { parent_id: id ?? undefined } })
      items.value = sortNodes(await Promise.all(data.items.map(decorate)))
      path.value = await Promise.all(data.path.map((p) => decorate({ ...p, is_folder: true })))
      currentFolder.value = data.parent ? await decorate(data.parent) : null
      currentId.value = id
      searching.value = false
    } catch (e) {
      error.value = errorMessage(e)
      if (e.response?.status === 404 && id !== null) return open(null) // dossier supprimé entre-temps
    } finally {
      loading.value = false
    }
  }

  async function search(q) {
    loading.value = true
    error.value = ''
    try {
      items.value = sortNodes(await Promise.all((await api.get('/search', { params: { q } })).data.items.map(decorate)))
      searching.value = true
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  const reload = () => (trashMode.value || searching.value ? Promise.resolve() : open(currentId.value, { silent: true }))

  // ─── Actions ───
  async function createFolder(label) {
    await api.post('/folders', { ...(await naming(currentVaultId(), label)), parent_id: currentId.value })
    await reload()
  }

  async function createVault(label) {
    const wrapped = await createVaultSecret(session.moduleKey)
    const vault = await openVault(wrapped, session.moduleKey)
    const { data } = await api.post('/vaults', { ...(await sealName(vault, label)), wrapped_key: wrapped })
    vaults.set(data.vault_id, vault)
    await reload()
  }

  async function rename(node, label) {
    await api.patch(`/nodes/${node.node_id}`, await naming(node.encrypted ? node.vault_id : null, label))
    await reload()
  }

  async function move(node, parentId) {
    await api.patch(`/nodes/${node.node_id}`, { parent_id: parentId })
    await reload()
  }

  // Supprimer = envoyer à la corbeille
  async function remove(node) {
    await api.delete(`/nodes/${node.node_id}`)
    await Promise.all([reload(), refreshUsage()])
  }

  // ─── Téléchargement / aperçu ───
  const link = async (node, inline) => (await api.post(`/nodes/${node.node_id}/link`, { inline })).data

  function saveBlob(blob, name) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  async function decryptToBlob(node) {
    const vault = vaults.get(node.vault_id)
    if (!vault) throw new Error('Clé du coffre indisponible')
    if (node.display_size > MAX_VAULT_FILE) {
      throw new Error(`Fichier trop volumineux pour être déchiffré dans le navigateur (${Math.round(MAX_VAULT_FILE / 1048576)} Mo maximum)`)
    }
    const { url, size } = await link(node, false)
    const res = await fetch(url)
    if (!res.ok || !res.body) throw new Error('Téléchargement impossible')
    return decryptFile(vault, res.body, size)
  }

  async function download(node) {
    if (node.encrypted) return saveBlob(await decryptToBlob(node), node.label)
    const a = document.createElement('a') // téléchargement natif : flux, progression, reprise
    a.href = (await link(node, false)).url
    a.download = node.name
    document.body.append(a)
    a.click()
    a.remove()
  }

  async function previewSource(node) {
    if (!node.encrypted) return { url: (await link(node, true)).url, revoke() {} }
    const blob = new Blob([await decryptToBlob(node)], { type: node.display_mime })
    const url = URL.createObjectURL(blob)
    return { url, revoke: () => URL.revokeObjectURL(url) }
  }

  // ─── Corbeille ───
  async function openTrash() {
    loading.value = true
    error.value = ''
    try {
      const { data } = await api.get('/trash')
      retentionDays.value = data.retention_days
      trashItems.value = await Promise.all(data.items.map(decorate)) // plus récents d'abord
      trashMode.value = true
    } catch (e) {
      error.value = errorMessage(e)
    } finally {
      loading.value = false
    }
  }

  async function restore(node, newLabel) {
    const body = newLabel ? await naming(node.encrypted ? node.vault_id : null, newLabel) : {}
    await api.post(`/trash/${node.node_id}/restore`, body)
    await Promise.all([openTrash(), refreshUsage()])
  }

  async function deleteForever(node) {
    await api.delete(`/trash/${node.node_id}`)
    await Promise.all([openTrash(), refreshUsage()])
  }

  async function emptyTrash() {
    await api.delete('/trash')
    await Promise.all([openTrash(), refreshUsage()])
  }

  // ─── Envois : file d'attente, 2 en parallèle, annulables ───
  const queue = []
  let running = 0
  let reloadTimer = null
  const claimed = new Set() // noms déjà choisis dans cet envoi (coffre : le serveur ne peut pas renommer)

  function scheduleReload() {
    clearTimeout(reloadTimer)
    reloadTimer = setTimeout(() => {
      reload()
      refreshUsage()
    }, 400)
  }

  function uniqueLabel(parentId, name) {
    const taken = new Set(items.value.map((i) => i.label.toLowerCase()))
    for (let i = 0; i < 1000; i++) {
      const candidate = numberedName(name, i)
      const key = `${parentId}:${candidate.toLowerCase()}`
      if (!taken.has(candidate.toLowerCase()) && !claimed.has(key)) {
        claimed.add(key)
        return candidate
      }
    }
    return name
  }

  function upload(files, parentId = currentId.value) {
    const vaultId = currentVaultId()
    for (const file of files) {
      const u = reactive({ id: crypto.randomUUID(), name: file.name, size: file.size, progress: 0, status: 'queued', error: '', controller: null })
      uploads.value.push(u)

      const sent = vaultId !== null ? encryptedSize(file.size) : file.size
      const free = usage.value?.free_bytes
      const max = usage.value?.max_upload_bytes
      const fail = (msg) => {
        u.status = 'error'
        u.error = msg
      }
      if (vaultId !== null && file.size > MAX_VAULT_FILE) fail(`Trop volumineux pour un coffre (${Math.round(MAX_VAULT_FILE / 1048576)} Mo max)`)
      else if (free !== null && free !== undefined && sent > free) fail('Quota insuffisant')
      else if (max && sent > max) fail('Fichier trop volumineux')
      else queue.push({ u, file, parentId, vaultId })
    }
    pump()
  }

  function pump() {
    while (running < MAX_PARALLEL && queue.length) {
      const job = queue.shift()
      if (job.u.status !== 'queued') continue
      running++
      run(job).finally(() => {
        running--
        pump()
      })
    }
  }

  async function run({ u, file, parentId, vaultId }) {
    const params = { name: file.name, parent_id: parentId ?? undefined }
    let body = file
    try {
      if (vaultId !== null) {
        const vault = vaults.get(vaultId)
        if (!vault) throw new Error('Clé du coffre indisponible')
        u.status = 'encrypting'
        const label = uniqueLabel(parentId, file.name)
        Object.assign(params, await sealName(vault, label))
        body = await encryptFile(vault, file, (p) => (u.progress = p))
        if (u.status === 'cancelled') return
        u.progress = 0
      }
      u.status = 'uploading'
      u.controller = new AbortController()
      await api.post('/upload', body, {
        params,
        headers: { 'Content-Type': 'application/octet-stream' },
        signal: u.controller.signal,
        timeout: 0,
        maxBodyLength: Infinity,
        onUploadProgress: (e) => {
          u.progress = e.total ? e.loaded / e.total : 0
        },
      })
      u.status = 'done'
      u.progress = 1
    } catch (e) {
      if (e.code === 'ERR_CANCELED') u.status = 'cancelled'
      else {
        u.status = 'error'
        u.error = e.response ? errorMessage(e) : (e.message ?? "Connexion perdue pendant l'envoi")
      }
    }
    u.controller = null
    scheduleReload()
  }

  function cancelUpload(u) {
    if (u.status === 'queued' || u.status === 'encrypting') u.status = 'cancelled'
    else u.controller?.abort()
  }

  const clearFinishedUploads = () => {
    uploads.value = uploads.value.filter((u) => ['queued', 'encrypting', 'uploading'].includes(u.status))
    claimed.clear()
  }

  return {
    items, path, currentId, currentFolder, inVault, loading, error, usage, searching, uploads,
    trashMode, trashItems, retentionDays,
    loadVaults, refreshUsage, open, search, reload, createFolder, createVault, rename, move, remove,
    download, previewSource, openTrash, restore, deleteForever, emptyTrash,
    upload, cancelUpload, clearFinishedUploads,
  }
}
