import { Router } from 'express'
import prisma from '../prisma'
import { ah } from '../utils/asyncHandler'
import { isStr } from '../utils/validators'
import { authMiddleware, resolveAuth } from '../middlewares/authMiddleware'
import { moduleAuth } from '../middlewares/moduleAuth'
import { accessibleModules } from '../services/access'

const router = Router()

// ─── Lobby : modules accessibles à l'utilisateur connecté ────────────────────
router.get('/modules', authMiddleware, ah(async (req, res) => {
  res.json(await accessibleModules(req.user!.user_id, req.user!.isAdmin))
}))

// ─── Auto-enregistrement d'un module (appelé à son démarrage) ────────────────
router.post('/modules/register', moduleAuth, ah(async (req, res) => {
  const id = req.moduleId!
  const { name, icon, path, version, internal_url } = req.body ?? {}

  if (!isStr(name, 100) || typeof path !== 'string' || !/^\/[a-z0-9-]+$/.test(path)) {
    return res.status(400).json({ error: 'name et path (ex: /passwords) requis' })
  }
  const data = {
    name,
    icon: isStr(icon, 64) ? icon : 'apps',
    path,
    version: isStr(version, 32) ? version : null,
    internal_url: isStr(internal_url, 255) ? internal_url : null,
    last_seen_at: new Date(),
  }

  // auto_grant et is_enabled sont gérés par l'admin : jamais écrasés ici
  await prisma.modules.upsert({
    where: { module_id: id },
    create: { module_id: id, ...data },
    update: data,
  })

  console.log(`[modules] "${id}" enregistré (${path})`)
  res.json({ ok: true })
}))

// ─── Introspection : un module valide le Bearer d'un utilisateur ─────────────
// Headers : Authorization: Bearer <jwt utilisateur>, X-Module-Id, X-Module-Secret
router.post('/introspect', moduleAuth, ah(async (req, res) => {
  const auth = await resolveAuth(req.headers.authorization)
  if (!auth) return res.status(401).json({ active: false, error: 'Token invalide ou révoqué' })

  const modules = await accessibleModules(auth.user.user_id, auth.isAdmin)
  if (!modules.some((m) => m.module_id === req.moduleId)) {
    return res.status(403).json({ active: true, error: 'Accès à ce module non autorisé' })
  }

  res.json({
    active: true,
    user_id: auth.user.user_id,
    email: auth.user.email,
    firstName: auth.user.firstName,
    lastName: auth.user.lastName,
    isAdmin: auth.isAdmin,
    modules: modules.map((m) => m.module_id),
  })
}))

export default router
