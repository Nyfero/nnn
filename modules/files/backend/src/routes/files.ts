import { Router } from 'express'
import { Transform, pipeline } from 'node:stream'
import prisma from '../prisma'
import { config } from '../config'
import { ah, HttpError, optId, parseId } from '../utils/http'
import { cleanEncName, cleanName, cleanNameKey, cleanWrappedKey, INLINE_SAFE, mimeFor } from '../utils/names'
import { signTicket } from '../utils/tickets'
import { defaultBackend, newKey } from '../storage'
import { usage, withUserLock } from '../services/quota'
import {
  ancestors,
  assertFolder,
  deleteRows,
  findClash,
  removeBlobs,
  serialize,
  subtree,
  uniqueName,
} from '../services/nodes'
import type { Naming } from '../services/nodes'

const router = Router()

// Dans une zone normale le client envoie un nom clair ; dans un coffre, un nom chiffré + son index.
function readNaming(encrypted: boolean, name: unknown, nameKey: unknown): Naming {
  if (encrypted) return { name: cleanEncName(name), name_key: cleanNameKey(nameKey), encrypted: true }
  return { name: cleanName(name), name_key: null, encrypted: false }
}

const NAME_EXISTS = () => new HttpError(409, 'Un élément porte déjà ce nom à cet endroit', 'NAME_EXISTS')

// ─── Quota ───────────────────────────────────────────────────────────────────
router.get('/me', ah(async (req, res) => {
  res.json({ ...(await usage(prisma, req.user!.user_id)), max_upload_bytes: config.maxUploadBytes || null })
}))

// ─── Contenu d'un dossier (racine si parent_id absent) ───────────────────────
router.get('/nodes', ah(async (req, res) => {
  const userId = req.user!.user_id
  const parentId = optId(req.query.parent_id)
  const parent = await assertFolder(prisma, userId, parentId)
  const [items, path] = await Promise.all([
    prisma.nodes.findMany({
      where: { user_id: userId, parent_id: parentId, status: 'ready', trashed_at: null },
      orderBy: [{ is_folder: 'desc' }, { name: 'asc' }], // sans effet utile dans un coffre : le client trie après déchiffrement
    }),
    parentId === null ? [] : ancestors(prisma, userId, parentId),
  ])
  res.json({ parent: parent ? serialize(parent) : null, path, items: items.map(serialize) })
}))

// Recherche par nom : zones non chiffrées uniquement (le serveur ne connaît pas les noms des coffres)
router.get('/search', ah(async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (q.length < 2 || q.length > 100) throw new HttpError(400, 'Recherche trop courte (2 caractères minimum)')
  const items = await prisma.nodes.findMany({
    where: { user_id: req.user!.user_id, status: 'ready', trashed_at: null, encrypted: false, name: { contains: q } },
    orderBy: { name: 'asc' },
    take: 100,
  })
  res.json({ items: items.map(serialize) })
}))

// ─── Coffres ─────────────────────────────────────────────────────────────────
// Clés (chiffrées par la clé maître de l'utilisateur) de tous ses coffres, corbeille comprise
router.get('/vaults', ah(async (req, res) => {
  const rows = await prisma.nodes.findMany({
    where: { user_id: req.user!.user_id, is_vault: true },
    select: { node_id: true, wrapped_key: true },
  })
  res.json(rows.map((r) => ({ vault_id: r.node_id, wrapped_key: r.wrapped_key })))
}))

// Un coffre est un dossier racine : { name, name_key, wrapped_key } produits par le navigateur
router.post('/vaults', ah(async (req, res) => {
  const userId = req.user!.user_id
  const naming = readNaming(true, req.body?.name, req.body?.name_key)
  const wrapped = cleanWrappedKey(req.body?.wrapped_key)

  const vault = await withUserLock(userId, async (tx) => {
    if (await findClash(tx, userId, null, naming)) throw NAME_EXISTS()
    const created = await tx.nodes.create({
      data: { user_id: userId, parent_id: null, is_folder: true, encrypted: true, is_vault: true, wrapped_key: wrapped, name: naming.name, name_key: naming.name_key },
    })
    return tx.nodes.update({ where: { node_id: created.node_id }, data: { vault_id: created.node_id } })
  })
  res.status(201).json(serialize(vault))
}))

// ─── Création de dossier ─────────────────────────────────────────────────────
router.post('/folders', ah(async (req, res) => {
  const userId = req.user!.user_id
  const parentId = optId(req.body?.parent_id)

  const folder = await withUserLock(userId, async (tx) => {
    const parent = await assertFolder(tx, userId, parentId)
    const encrypted = parent?.encrypted ?? false
    const naming = readNaming(encrypted, req.body?.name, req.body?.name_key)
    if (await findClash(tx, userId, parentId, naming)) throw NAME_EXISTS()
    return tx.nodes.create({
      data: {
        user_id: userId, parent_id: parentId, is_folder: true, name: naming.name, name_key: naming.name_key,
        encrypted, vault_id: parent?.vault_id ?? null,
      },
    })
  })
  res.status(201).json(serialize(folder))
}))

// ─── Téléversement ───────────────────────────────────────────────────────────
// Corps brut (application/octet-stream) diffusé directement sur le disque : pas de mémoire consommée,
// pas de multipart. La taille annoncée (Content-Length) est réservée dans le quota AVANT d'écrire.
// Dans un coffre, le corps est déjà chiffré par le navigateur et le nom arrive chiffré (name + name_key).
router.post('/upload', ah(async (req, res) => {
  const userId = req.user!.user_id
  const parentId = optId(req.query.parent_id)

  const size = Number(req.headers['content-length'])
  if (!req.headers['content-length'] || !Number.isSafeInteger(size) || size < 0) {
    throw new HttpError(411, 'Content-Length requis')
  }
  if (config.maxUploadBytes && size > config.maxUploadBytes) {
    throw new HttpError(413, 'Fichier trop volumineux', 'FILE_TOO_LARGE')
  }

  const backend = defaultBackend()
  const cap = await backend.capacity()
  if (cap && cap.freeBytes - size < config.minFreeBytes) {
    throw new HttpError(507, 'Espace disque du serveur insuffisant', 'DISK_FULL')
  }

  const key = newKey(userId)
  const node = await withUserLock(userId, async (tx) => {
    const parent = await assertFolder(tx, userId, parentId)
    const encrypted = parent?.encrypted ?? false
    const naming = readNaming(encrypted, req.query.name, req.query.name_key)

    const u = await usage(tx, userId)
    if (u.quota_bytes !== null && u.used_bytes + size > u.quota_bytes) {
      throw new HttpError(507, 'Quota insuffisant', 'QUOTA_EXCEEDED')
    }

    let name = naming.name
    if (encrypted) {
      if (await findClash(tx, userId, parentId, naming)) throw NAME_EXISTS() // le client choisit un autre nom
    } else {
      name = await uniqueName(tx, userId, parentId, naming.name) // doublon : « fichier (1).ext »
    }
    return tx.nodes.create({
      data: {
        user_id: userId, parent_id: parentId, name, name_key: naming.name_key, is_folder: false, size,
        encrypted, vault_id: parent?.vault_id ?? null, mime: encrypted ? null : mimeFor(name),
        storage_backend: backend.name, storage_key: key, status: 'uploading',
      },
    })
  })

  let received = 0
  const counter = new Transform({
    transform(chunk, _enc, cb) {
      received += chunk.length
      if (received > size) return cb(new Error('Corps plus long que Content-Length'))
      cb(null, chunk)
    },
  })

  try {
    const written = await backend.write(key, pipeline(req, counter, () => {}))
    if (written !== size) throw new HttpError(400, 'Transfert incomplet')
    const done = await prisma.nodes.updateMany({
      where: { node_id: node.node_id, status: 'uploading' },
      data: { status: 'ready', size: written },
    })
    if (done.count === 0) throw new HttpError(409, 'Le dossier de destination a été supprimé pendant le transfert')
    res.status(201).json(serialize(await prisma.nodes.findUniqueOrThrow({ where: { node_id: node.node_id } })))
  } catch (err) {
    await prisma.nodes.deleteMany({ where: { node_id: node.node_id, status: 'uploading' } }).catch(() => {})
    await backend.remove(key).catch(() => {})
    throw err
  }
}))

// ─── Renommer / déplacer ─────────────────────────────────────────────────────
// Un élément ne change jamais de zone : pas de déplacement entre zone normale et coffre, ni entre coffres
// (il faudrait rechiffrer : à faire côté navigateur, en téléchargeant puis en renvoyant le fichier).
router.patch('/nodes/:id', ah(async (req, res) => {
  const userId = req.user!.user_id
  const id = parseId(req.params.id)
  const body = req.body ?? {}
  const hasName = body.name !== undefined
  const hasParent = 'parent_id' in body
  if (!id || (!hasName && !hasParent)) throw new HttpError(400, 'Champs invalides')

  const updated = await withUserLock(userId, async (tx) => {
    const node = await tx.nodes.findFirst({ where: { node_id: id, user_id: userId, status: 'ready', trashed_at: null } })
    if (!node) throw new HttpError(404, 'Élément introuvable')

    const naming: Naming = hasName
      ? readNaming(node.encrypted, body.name, body.name_key)
      : { name: node.name, name_key: node.name_key, encrypted: node.encrypted }

    let parentId = node.parent_id
    if (hasParent) {
      if (node.is_vault) throw new HttpError(400, 'Un coffre ne peut pas être déplacé')
      parentId = optId(body.parent_id)
      const target = await assertFolder(tx, userId, parentId)
      if ((target?.vault_id ?? null) !== (node.vault_id ?? null)) {
        throw new HttpError(400, "Déplacement impossible entre un coffre et l'extérieur (ou un autre coffre) : téléchargez puis renvoyez le fichier")
      }
      if (parentId !== null && node.is_folder) {
        const inside = (await subtree(tx, userId, id)).some((r) => r.node_id === parentId)
        if (inside) throw new HttpError(400, 'Impossible de déplacer un dossier dans lui-même')
      }
    }
    if (!hasName && parentId === node.parent_id) return node
    if (hasName && naming.name === node.name && parentId === node.parent_id) return node

    if (await findClash(tx, userId, parentId, naming, id)) throw NAME_EXISTS()

    return tx.nodes.update({
      where: { node_id: id },
      data: {
        name: naming.name, name_key: naming.name_key, parent_id: parentId,
        ...(node.is_folder || node.encrypted ? {} : { mime: mimeFor(naming.name) }),
      },
    })
  })
  res.json(serialize(updated))
}))

// ─── Suppression = envoi à la corbeille ──────────────────────────────────────
router.delete('/nodes/:id', ah(async (req, res) => {
  const userId = req.user!.user_id
  const id = parseId(req.params.id)
  if (!id) throw new HttpError(400, 'Identifiant invalide')

  await withUserLock(userId, async (tx) => {
    const node = await tx.nodes.findFirst({ where: { node_id: id, user_id: userId, trashed_at: null } })
    if (!node) throw new HttpError(404, 'Élément introuvable')
    const stamp = new Date()
    const ids = (await subtree(tx, userId, id)).map((r) => r.node_id)
    // les éléments déjà dans la corbeille gardent leur propre date
    for (let i = 0; i < ids.length; i += 1000) {
      await tx.nodes.updateMany({ where: { node_id: { in: ids.slice(i, i + 1000) }, trashed_at: null }, data: { trashed_at: stamp } })
    }
    await tx.nodes.update({ where: { node_id: id }, data: { trash_root: true } })
  })
  res.status(204).end()
}))

// ─── Corbeille ───────────────────────────────────────────────────────────────
router.get('/trash', ah(async (req, res) => {
  const items = await prisma.nodes.findMany({
    where: { user_id: req.user!.user_id, trash_root: true },
    orderBy: { trashed_at: 'desc' },
  })
  const ttl = config.trashDays * 24 * 3600_000
  res.json({
    retention_days: config.trashDays,
    items: items.map((n) => ({ ...serialize(n), expires_at: new Date(n.trashed_at!.getTime() + ttl) })),
  })
}))

// Restaure à l'emplacement d'origine. Dossier d'origine absent ou lui-même à la corbeille : racine (zone normale seulement,
// un élément de coffre exige que son dossier soit d'abord restauré). Nom déjà pris : « fichier (1).ext » en zone normale,
// 409 NAME_EXISTS dans un coffre (le client renvoie alors un nouveau nom chiffré dans { name, name_key }).
router.post('/trash/:id/restore', ah(async (req, res) => {
  const userId = req.user!.user_id
  const id = parseId(req.params.id)
  if (!id) throw new HttpError(400, 'Identifiant invalide')

  const restored = await withUserLock(userId, async (tx) => {
    const node = await tx.nodes.findFirst({ where: { node_id: id, user_id: userId, trash_root: true } })
    if (!node || !node.trashed_at) throw new HttpError(404, 'Élément introuvable dans la corbeille')

    let parentId = node.parent_id
    if (parentId !== null) {
      const parent = await tx.nodes.findFirst({ where: { node_id: parentId, user_id: userId, is_folder: true, trashed_at: null } })
      if (!parent) {
        if (node.encrypted) throw new HttpError(409, "Restaurez d'abord le dossier parent (dans la corbeille)", 'PARENT_TRASHED')
        parentId = null
      }
    }

    let naming: Naming = { name: node.name, name_key: node.name_key, encrypted: node.encrypted }
    if (req.body?.name !== undefined) naming = readNaming(node.encrypted, req.body.name, req.body.name_key)
    if (await findClash(tx, userId, parentId, naming, id)) {
      if (node.encrypted) throw NAME_EXISTS()
      naming = { ...naming, name: await uniqueName(tx, userId, parentId, naming.name) }
    }

    const ids = (await subtree(tx, userId, id)).map((r) => r.node_id)
    for (let i = 0; i < ids.length; i += 1000) {
      await tx.nodes.updateMany({ where: { node_id: { in: ids.slice(i, i + 1000) }, trashed_at: node.trashed_at }, data: { trashed_at: null } })
    }
    return tx.nodes.update({
      where: { node_id: id },
      data: {
        trash_root: false, trashed_at: null, parent_id: parentId, name: naming.name, name_key: naming.name_key,
        ...(node.is_folder || node.encrypted ? {} : { mime: mimeFor(naming.name) }),
      },
    })
  })
  res.json(serialize(restored))
}))

// Suppression définitive d'un élément de la corbeille
router.delete('/trash/:id', ah(async (req, res) => {
  const userId = req.user!.user_id
  const id = parseId(req.params.id)
  if (!id) throw new HttpError(400, 'Identifiant invalide')

  const rows = await withUserLock(userId, async (tx) => {
    const node = await tx.nodes.findFirst({ where: { node_id: id, user_id: userId, trash_root: true }, select: { node_id: true } })
    if (!node) throw new HttpError(404, 'Élément introuvable dans la corbeille')
    const sub = await subtree(tx, userId, id)
    await deleteRows(tx, sub.map((r) => r.node_id))
    return sub
  })
  await removeBlobs(rows)
  res.status(204).end()
}))

// Vider la corbeille
router.delete('/trash', ah(async (req, res) => {
  const userId = req.user!.user_id
  const rows = await withUserLock(userId, async (tx) => {
    const all = await tx.nodes.findMany({
      where: { user_id: userId, trashed_at: { not: null } },
      select: { node_id: true, is_folder: true, storage_backend: true, storage_key: true },
    })
    await deleteRows(tx, all.map((r) => r.node_id))
    return all
  })
  await removeBlobs(rows)
  res.json({ deleted: rows.length })
}))

// ─── Lien de téléchargement / d'aperçu (voir routes/download.ts) ─────────────
router.post('/nodes/:id/link', ah(async (req, res) => {
  const userId = req.user!.user_id
  const id = parseId(req.params.id)
  if (!id) throw new HttpError(400, 'Identifiant invalide')
  const node = await prisma.nodes.findFirst({
    where: { node_id: id, user_id: userId, is_folder: false, status: 'ready', trashed_at: null },
  })
  if (!node) throw new HttpError(404, 'Fichier introuvable')

  // un fichier de coffre est toujours servi en téléchargement : le navigateur le déchiffre lui-même
  const inline = !!req.body?.inline && !node.encrypted && INLINE_SAFE.has(node.mime ?? '')
  const ttl = inline ? config.inlineTtlMs : config.downloadTtlMs
  const token = signTicket({ n: node.node_id, u: userId, i: inline }, ttl, config.moduleSecret)
  res.json({ url: `/api/${config.moduleId}/dl/${token}`, inline, size: Number(node.size), expires_in: Math.floor(ttl / 1000) })
}))

export default router
