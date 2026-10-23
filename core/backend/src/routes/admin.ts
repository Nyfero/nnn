import { Router } from 'express'
import prisma from '../prisma'
import { ROLES, TOKEN_TYPES, TTL } from '../config'
import { ah } from '../utils/asyncHandler'
import { authMiddleware } from '../middlewares/authMiddleware'
import { isAdmin } from '../middlewares/isAdmin'
import { grantAutoModules } from '../services/access'
import { issueToken } from '../services/tokens'
import { sendAccountSetupToUser, sendRejectedToUser } from '../services/email/email'

const router = Router()
router.use(authMiddleware, isAdmin)

const parseId = (v: string | undefined) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

// ─── Inscriptions en attente (email vérifié, pas encore validées) ────────────
router.get('/pending-users', ah(async (_req, res) => {
  res.json(
    await prisma.users.findMany({
      where: { is_active: false, is_email_verified: true },
      select: { user_id: true, email: true, firstName: true, lastName: true, created_at: true },
      orderBy: { created_at: 'asc' },
    })
  )
}))

router.post('/approve/:user_id', ah(async (req, res) => {
  const id = parseId(req.params.user_id)
  if (!id) return res.status(400).json({ error: 'Identifiant invalide' })

  const user = await prisma.users.findUnique({ where: { user_id: id } })
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })
  if (!user.is_email_verified) return res.status(400).json({ error: 'Email non vérifié' })
  if (user.is_active) return res.status(400).json({ error: 'Compte déjà validé' })

  await prisma.users.update({
    where: { user_id: id },
    data: {
      is_active: true,
      userRoles: {
        create: {
          role: {
            connectOrCreate: {
              where: { role: ROLES.USER },
              create: { role: ROLES.USER },
            },
          },
        },
      },
    },
  })
  await grantAutoModules(id)

  const token = await issueToken(id, TOKEN_TYPES.ACTIVATE, TTL.ACTIVATE_MS)
  await sendAccountSetupToUser(user, token).catch((e) =>
    console.error('Erreur envoi email setup :', e)
  )

  res.json({ message: `Compte de ${user.email} validé. Email envoyé.` })
}))

router.delete('/reject/:user_id', ah(async (req, res) => {
  const id = parseId(req.params.user_id)
  if (!id) return res.status(400).json({ error: 'Identifiant invalide' })

  const user = await prisma.users.findUnique({ where: { user_id: id } })
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })
  if (user.is_active) {
    return res.status(400).json({ error: 'Impossible de refuser un compte déjà validé' })
  }

  await prisma.users.delete({ where: { user_id: id } })
  await sendRejectedToUser(user).catch((e) => console.error('Erreur envoi email rejet :', e))

  res.json({ message: `Compte de ${user.email} refusé et supprimé.` })
}))

// ─── Utilisateurs & accès aux modules ────────────────────────────────────────
router.get('/users', ah(async (_req, res) => {
  const users = await prisma.users.findMany({
    where: { is_active: true },
    select: {
      user_id: true, email: true, firstName: true, lastName: true, created_at: true,
      userRoles: { select: { role: { select: { role: true } } } },
      userModules: { select: { module_id: true } },
    },
    orderBy: { created_at: 'asc' },
  })
  res.json(
    users.map(({ userRoles, userModules, ...u }) => ({
      ...u,
      isAdmin: userRoles.some((r) => r.role.role === ROLES.ADMIN),
      modules: userModules.map((m) => m.module_id),
    }))
  )
}))

router.put('/users/:user_id/modules', ah(async (req, res) => {
  const id = parseId(req.params.user_id)
  const list: unknown = req.body?.modules
  if (!id || !Array.isArray(list) || !list.every((m) => typeof m === 'string')) {
    return res.status(400).json({ error: 'Champs invalides' })
  }

  const user = await prisma.users.findUnique({ where: { user_id: id } })
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })

  const known = await prisma.modules.findMany({
    where: { module_id: { in: list as string[] } },
    select: { module_id: true },
  })
  await prisma.$transaction([
    prisma.userModules.deleteMany({ where: { user_id: id } }),
    prisma.userModules.createMany({
      data: known.map((m) => ({ user_id: id, module_id: m.module_id })),
    }),
  ])
  res.json({ modules: known.map((m) => m.module_id) })
}))

router.get('/modules', ah(async (_req, res) => {
  res.json(await prisma.modules.findMany({ orderBy: { name: 'asc' } }))
}))

router.patch('/modules/:module_id', ah(async (req, res) => {
  const { is_enabled, auto_grant } = req.body ?? {}
  const data: { is_enabled?: boolean; auto_grant?: boolean } = {}
  if (typeof is_enabled === 'boolean') data.is_enabled = is_enabled
  if (typeof auto_grant === 'boolean') data.auto_grant = auto_grant
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Rien à modifier' })

  const exists = await prisma.modules.findUnique({ where: { module_id: req.params.module_id } })
  if (!exists) return res.status(404).json({ error: 'Module introuvable' })

  res.json(await prisma.modules.update({ where: { module_id: req.params.module_id }, data }))
}))

export default router
