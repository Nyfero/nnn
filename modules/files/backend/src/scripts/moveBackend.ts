// Déplace tous les fichiers d'un backend de stockage vers un autre (changement de disque).
//   docker compose exec files-backend npm run move-backend -- <source> <destination> [--dry-run]
// Les deux backends doivent être configurés (FILES_EXTRA_BACKENDS). Sans danger si interrompu : on peut relancer.
import 'dotenv/config'
import prisma from '../prisma'
import { getBackend, initStorage } from '../storage'

const args = process.argv.slice(2)
const dry = args.includes('--dry-run')
const [from, to] = args.filter((a) => !a.startsWith('--'))

async function main() {
  if (!from || !to || from === to) throw new Error('Usage : move-backend <source> <destination> [--dry-run]')
  await initStorage()
  const src = getBackend(from)
  const dst = getBackend(to)

  const files = await prisma.nodes.findMany({
    where: { storage_backend: from, is_folder: false, status: 'ready' },
    select: { node_id: true, size: true, storage_key: true },
  })
  const total = files.reduce((a, f) => a + Number(f.size), 0)
  console.log(`${files.length} fichier(s) à déplacer de "${from}" vers "${to}" (${(total / 1024 ** 3).toFixed(2)} Gio)`)
  if (dry) return

  let moved = 0
  for (const f of files) {
    const key = f.storage_key!
    const written = await dst.write(key, src.read(key))
    if (written !== Number(f.size)) {
      await dst.remove(key)
      throw new Error(`Taille différente après copie (node ${f.node_id}) : arrêt, rien n'a été supprimé de la source pour ce fichier`)
    }
    // Bascule en base seulement si le fichier existe toujours et n'a pas déjà bougé
    const { count } = await prisma.nodes.updateMany({
      where: { node_id: f.node_id, storage_backend: from },
      data: { storage_backend: to },
    })
    if (count === 1) await src.remove(key)
    else await dst.remove(key) // supprimé pendant la copie
    if (++moved % 50 === 0) console.log(`  ${moved}/${files.length}`)
  }
  console.log(`Terminé : ${moved} fichier(s) déplacé(s). Vous pouvez maintenant retirer "${from}" de la configuration.`)
}

main()
  .catch((err) => {
    console.error(err.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
