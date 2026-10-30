import type { Prisma, nodes } from '@prisma/client'
import { getBackend } from '../storage'
import { HttpError } from '../utils/http'
import { numberedName } from '../utils/names'

type Db = Prisma.TransactionClient

export const serialize = (n: nodes) => ({
  node_id: n.node_id,
  parent_id: n.parent_id,
  name: n.name,
  is_folder: n.is_folder,
  size: Number(n.size),
  mime: n.mime,
  encrypted: n.encrypted,
  is_vault: n.is_vault,
  vault_id: n.vault_id,
  trashed_at: n.trashed_at,
  created_at: n.created_at,
  updated_at: n.updated_at,
})

export async function assertFolder(db: Db, userId: number, id: number | null) {
  if (id === null) return null
  const folder = await db.nodes.findFirst({ where: { node_id: id, user_id: userId, is_folder: true, trashed_at: null } })
  if (!folder) throw new HttpError(404, 'Dossier introuvable')
  return folder
}

export interface BlobRef {
  node_id: number
  is_folder: boolean
  storage_backend: string | null
  storage_key: string | null
}

// L'élément et tous ses descendants (CTE récursive, bornée à l'utilisateur)
export async function subtree(db: Db, userId: number, id: number): Promise<BlobRef[]> {
  const rows = await db.$queryRaw<
    { node_id: number | bigint; is_folder: number | boolean; storage_backend: string | null; storage_key: string | null }[]
  >`
    WITH RECURSIVE sub AS (
      SELECT node_id, is_folder, storage_backend, storage_key FROM nodes
      WHERE node_id = ${id} AND user_id = ${userId}
      UNION ALL
      SELECT n.node_id, n.is_folder, n.storage_backend, n.storage_key
      FROM nodes n JOIN sub s ON n.parent_id = s.node_id
    )
    SELECT node_id, is_folder, storage_backend, storage_key FROM sub`
  return rows.map((r) => ({ ...r, node_id: Number(r.node_id), is_folder: Boolean(r.is_folder) }))
}

// Chemin racine -> dossier (fil d'Ariane)
export async function ancestors(db: Db, userId: number, id: number) {
  const rows = await db.$queryRaw<
    { node_id: number | bigint; name: string; encrypted: number | boolean; vault_id: number | null; depth: number | bigint }[]
  >`
    WITH RECURSIVE up AS (
      SELECT node_id, parent_id, name, encrypted, vault_id, 0 AS depth FROM nodes WHERE node_id = ${id} AND user_id = ${userId}
      UNION ALL
      SELECT n.node_id, n.parent_id, n.name, n.encrypted, n.vault_id, up.depth + 1 FROM nodes n JOIN up ON n.node_id = up.parent_id
    )
    SELECT node_id, name, encrypted, vault_id, depth FROM up ORDER BY depth DESC`
  return rows.map((r) => ({ node_id: Number(r.node_id), name: r.name, encrypted: Boolean(r.encrypted), vault_id: r.vault_id }))
}

export async function uniqueName(db: Db, userId: number, parentId: number | null, name: string) {
  for (let i = 0; i < 1000; i++) {
    const candidate = numberedName(name, i)
    const clash = await db.nodes.findFirst({
      where: { user_id: userId, parent_id: parentId, name: candidate, encrypted: false, trashed_at: null },
      select: { node_id: true },
    })
    if (!clash) return candidate
  }
  throw new HttpError(409, 'Trop de fichiers portent ce nom', 'NAME_EXISTS')
}

export async function deleteRows(db: Db, ids: number[]) {
  for (let i = 0; i < ids.length; i += 1000) {
    await db.nodes.deleteMany({ where: { node_id: { in: ids.slice(i, i + 1000) } } })
  }
}

// Suppression des blobs APRÈS la validation en base : au pire un blob orphelin, jamais une ligne sans fichier.
export async function removeBlobs(rows: { is_folder?: boolean; storage_backend: string | null; storage_key: string | null }[]) {
  for (const r of rows) {
    if (r.is_folder || !r.storage_backend || !r.storage_key) continue
    try {
      await getBackend(r.storage_backend).remove(r.storage_key)
    } catch (err) {
      console.error(`[files] blob non supprimé (${r.storage_backend}:${r.storage_key}) :`, (err as Error).message)
    }
  }
}

// Un nom est « pris » parmi les éléments hors corbeille du même dossier.
// Zone normale : comparaison du nom. Coffre : comparaison de l'index HMAC (le serveur ne connaît pas les noms).
export interface Naming {
  name: string
  name_key: string | null
  encrypted: boolean
}

export const findClash = (db: Db, userId: number, parentId: number | null, n: Naming, excludeId?: number) =>
  db.nodes.findFirst({
    where: {
      user_id: userId,
      parent_id: parentId,
      trashed_at: null,
      ...(n.encrypted ? { encrypted: true, name_key: n.name_key } : { encrypted: false, name: n.name }),
      ...(excludeId ? { NOT: { node_id: excludeId } } : {}),
    },
    select: { node_id: true },
  })
