import 'dotenv/config'
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import { coreAuth, registerModule, requireModuleSecret } from '@myprout/sdk/server'
import prisma from './prisma'
import { config } from './config'
import { initStorage } from './storage'
import { HttpError, ah } from './utils/http'
import { removeBlobs } from './services/nodes'
import { purgeExpiredTrash } from './services/trash'
import filesRoutes from './routes/files'
import adminRoutes from './routes/admin'
import downloadRoutes from './routes/download'

if (!config.moduleSecret) {
  console.error('MODULE_SECRET manquant')
  process.exit(1)
}

const app = express()
app.set('trust proxy', 1)
app.use(express.json({ limit: '100kb' })) // ne concerne que le JSON : les envois de fichiers (octet-stream) restent en flux

const base = `/api/${config.moduleId}`
app.get(`${base}/health`, (_req, res) => res.json({ status: 'ok' }))

// Appelé par le core quand un compte est supprimé : purge fichiers (blobs inclus) et quota
app.delete(
  `${base}/internal/users/:user_id`,
  requireModuleSecret(config.moduleSecret),
  ah(async (req, res) => {
    const userId = Number(req.params.user_id)
    if (!Number.isInteger(userId) || userId <= 0) throw new HttpError(400, 'Identifiant invalide')
    const rows = await prisma.nodes.findMany({
      where: { user_id: userId, is_folder: false },
      select: { storage_backend: true, storage_key: true },
    })
    await prisma.$transaction([
      prisma.nodes.deleteMany({ where: { user_id: userId } }),
      prisma.accounts.deleteMany({ where: { user_id: userId } }),
    ])
    await removeBlobs(rows)
    console.log(`[files] ${rows.length} fichier(s) supprimé(s) pour l'utilisateur ${userId}`)
    res.json({ deleted: rows.length })
  })
)

app.get(
  `${base}/internal/users/:user_id/count`,
  requireModuleSecret(config.moduleSecret),
  ah(async (req, res) => {
    const userId = Number(req.params.user_id)
    if (!Number.isInteger(userId) || userId <= 0) throw new HttpError(400, 'Identifiant invalide')
    res.json({ count: await prisma.nodes.count({ where: { user_id: userId } }) })
  })
)

// Téléchargements : autorisés par un lien signé (pas de Bearer possible sur un <a href>)
app.use(`${base}/dl`, downloadRoutes)

// Tout le reste exige un utilisateur connecté ayant accès au module (validé par le core)
const auth = coreAuth({ coreUrl: config.coreUrl, moduleId: config.moduleId, moduleSecret: config.moduleSecret })
app.use(`${base}/admin`, auth, adminRoutes)
app.use(base, auth, filesRoutes)

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return res.destroy()
  // Erreur avant la fin de la lecture d'un envoi : on ferme la connexion plutôt que d'aspirer le reste du fichier
  if (!req.complete) res.setHeader('Connection', 'close')
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, code: err.code })
  console.error(err)
  res.status(500).json({ error: 'Erreur serveur' })
})

// Envois interrompus (crash, coupure) : lignes "uploading" jamais finalisées
async function cleanupUploads(all: boolean) {
  const where = { status: 'uploading', ...(all ? {} : { created_at: { lt: new Date(Date.now() - 12 * 3600_000) } }) }
  const stale = await prisma.nodes.findMany({ where, select: { node_id: true, storage_backend: true, storage_key: true } })
  if (stale.length === 0) return
  await prisma.nodes.deleteMany({ where: { node_id: { in: stale.map((s) => s.node_id) } } })
  await removeBlobs(stale)
  console.log(`[files] ${stale.length} envoi(s) interrompu(s) nettoyé(s)`)
}

async function main() {
  await initStorage()
  await cleanupUploads(true) // une seule instance : aucun envoi ne peut être en cours au démarrage
  setInterval(() => cleanupUploads(false).catch(console.error), 15 * 60_000)
  await purgeExpiredTrash().catch(console.error)
  setInterval(() => purgeExpiredTrash().catch(console.error), 60 * 60_000)

  app.listen(config.port, () => {
    console.log(`[files] http://localhost:${config.port}${base}`)
    registerModule({
      coreUrl: config.coreUrl,
      id: config.moduleId,
      secret: config.moduleSecret,
      name: process.env.MODULE_NAME ?? 'Fichiers',
      icon: process.env.MODULE_ICON ?? 'folder',
      path: process.env.MODULE_PATH ?? `/${config.moduleId}`,
      version: process.env.npm_package_version ?? '1.0.0',
      internalUrl: process.env.MODULE_INTERNAL_URL,
    })
  })
}

main().catch((err) => {
  console.error('[files] démarrage impossible :', err.message)
  process.exit(1)
})
