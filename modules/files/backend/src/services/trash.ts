import prisma from '../prisma'
import { config } from '../config'
import { withUserLock } from './quota'
import { deleteRows, removeBlobs, subtree } from './nodes'

// Supprime définitivement les éléments restés plus de FILES_TRASH_DAYS jours dans la corbeille
// (dossier + contenu + blobs). Chaque suppression est faite sous le verrou de l'utilisateur.
export async function purgeExpiredTrash(): Promise<number> {
  const cutoff = new Date(Date.now() - config.trashDays * 24 * 3600_000)
  const roots = await prisma.nodes.findMany({
    where: { trash_root: true, trashed_at: { lt: cutoff } },
    select: { node_id: true, user_id: true },
  })
  let purged = 0
  for (const root of roots) {
    const rows = await withUserLock(root.user_id, async (tx) => {
      // l'utilisateur a pu restaurer l'élément entre-temps
      const still = await tx.nodes.findFirst({ where: { node_id: root.node_id, trash_root: true }, select: { node_id: true } })
      if (!still) return []
      const sub = await subtree(tx, root.user_id, root.node_id)
      await deleteRows(tx, sub.map((r) => r.node_id))
      return sub
    })
    await removeBlobs(rows)
    purged += rows.length
  }
  if (purged) console.log(`[files] corbeille : ${purged} élément(s) supprimé(s) définitivement (> ${config.trashDays} j)`)
  return purged
}
