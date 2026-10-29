import 'dotenv/config'
import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import { coreAuth, registerModule, requireModuleSecret } from '@myprout/sdk/server'
import prisma from './prisma'
import { DockerError } from './docker'
import { requireAdmin } from './middlewares/requireAdmin'
import serverRoutes from './routes/servers'
import adminRoutes from './routes/admin'

const MODULE_ID = process.env.MODULE_ID ?? 'servers'
const MODULE_SECRET = process.env.MODULE_SECRET
const CORE_URL = process.env.CORE_URL ?? 'http://core-backend:3000'
const PORT = Number(process.env.PORT ?? 3000)

if (!MODULE_SECRET) {
  console.error('MODULE_SECRET manquant')
  process.exit(1)
}

const app = express()
app.set('trust proxy', 1)
app.use(express.json({ limit: '100kb' }))

const base = `/api/${MODULE_ID}`
app.get(`${base}/health`, (_req, res) => res.json({ status: 'ok' }))

// Appelé par le core quand un compte est supprimé : retire ses permissions
app.delete(
  `${base}/internal/users/:user_id`,
  requireModuleSecret(MODULE_SECRET),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.user_id)
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Identifiant invalide' })
      }
      const { count } = await prisma.serverPermissions.deleteMany({ where: { user_id: userId } })
      console.log(`[servers] ${count} permission(s) supprimée(s) pour l'utilisateur ${userId}`)
      res.json({ deleted: count })
    } catch (err) {
      next(err)
    }
  }
)

// Tout le reste exige un utilisateur connecté ayant accès au module (validé par le core)
app.use(base, coreAuth({ coreUrl: CORE_URL, moduleId: MODULE_ID, moduleSecret: MODULE_SECRET }))
app.use(`${base}/admin`, requireAdmin, adminRoutes)
app.use(base, serverRoutes)

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof DockerError) return res.status(err.status).json({ error: err.message })
  console.error(err)
  res.status(500).json({ error: 'Erreur serveur' })
})

app.listen(PORT, () => {
  console.log(`[servers] http://localhost:${PORT}${base}`)

  registerModule({
    coreUrl: CORE_URL,
    id: MODULE_ID,
    secret: MODULE_SECRET,
    name: process.env.MODULE_NAME ?? 'Serveurs de jeu',
    icon: process.env.MODULE_ICON ?? 'sports_esports',
    path: process.env.MODULE_PATH ?? `/${MODULE_ID}`,
    version: process.env.npm_package_version ?? '1.0.0',
    internalUrl: process.env.MODULE_INTERNAL_URL,
  })
})
