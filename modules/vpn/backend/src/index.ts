import 'dotenv/config'
import express from 'express'
import type { Request, Response, NextFunction } from 'express'
import {
  coreAuth,
  registerModule,
  requireModuleSecret,
} from '@myprout/sdk/server'
import prisma from './prisma'
import deviceRoutes from './routes/devices'
import { ALLOWED_ROLES, MODULE_ID, RECONCILE_MS } from './config'
import { syncPeers } from './services/wireguard'
import { startReconcile } from './services/reconcile'
import { requireRole } from './middlewares/requireRole'

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

// Appelé par le core quand un compte est supprimé : retire les appareils de l'utilisateur
app.delete(
  `${base}/internal/users/:user_id`,
  requireModuleSecret(MODULE_SECRET),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.user_id)
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Identifiant invalide' })
      }
      const { count } = await prisma.devices.deleteMany({ where: { user_id: userId } })
      await syncPeers()
      console.log(`[vpn] ${count} appareil(s) supprimé(s) pour l'utilisateur ${userId}`)
      res.json({ deleted: count })
    } catch (err) {
      next(err)
    }
  }
)

app.get(
  `${base}/internal/users/:user_id/count`,
  requireModuleSecret(MODULE_SECRET),
  async (req, res, next) => {
    try {
      const userId = Number(req.params.user_id)
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Identifiant invalide' })
      }
      res.json({ count: await prisma.devices.count({ where: { user_id: userId } }) })
    } catch (err) {
      next(err)
    }
  }
)

// Tout le reste exige un utilisateur connecté ayant accès au module (validé par le core),
// ET membre d'un rôle autorisé (FAMILLE par défaut) ou admin : l'accès au VPN est plus strict
// que l'accès au module (un rôle « tous les modules » comme AMIS ne suffit pas).
app.use(
  base,
  coreAuth({ coreUrl: CORE_URL, moduleId: MODULE_ID, moduleSecret: MODULE_SECRET }),
  requireRole(ALLOWED_ROLES),
  deviceRoutes
)

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Erreur serveur' })
})

app.listen(PORT, () => {
  console.log(`[vpn] http://localhost:${PORT}${base}`)

  registerModule({
    coreUrl: CORE_URL,
    id: MODULE_ID,
    secret: MODULE_SECRET,
    name: process.env.MODULE_NAME ?? 'VPN',
    icon: process.env.MODULE_ICON ?? 'vpn_lock',
    path: process.env.MODULE_PATH ?? `/${MODULE_ID}`,
    version: process.env.npm_package_version ?? '1.0.0',
    internalUrl: process.env.MODULE_INTERNAL_URL,
  })

  startReconcile({
    coreUrl: CORE_URL,
    moduleId: MODULE_ID,
    secret: MODULE_SECRET,
    roles: ALLOWED_ROLES,
    everyMs: RECONCILE_MS,
  })
})
