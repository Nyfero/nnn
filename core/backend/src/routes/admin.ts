import { Router } from 'express'
import prisma from '../prisma'
import { ROLES, TOKEN_TYPES, TTL } from '../config'
import { ah } from '../utils/asyncHandler'
import { authMiddleware } from '../middlewares/authMiddleware'
import { isAdmin } from '../middlewares/isAdmin'
import { accessibleModules } from '../services/access'
import { issueToken } from '../services/tokens'
import {
  sendAccountSetupToUser,
  sendRejectedToUser,
} from '../services/email/email'

const router = Router()
router.use(authMiddleware, isAdmin)

const parseId = (v: string | undefined) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

// ─── Inscriptions en attente (email vérifié, pas encore validées) ────────────
router.get(
  '/pending-users',
  ah(async (_req, res) => {
    res.json(
      await prisma.users.findMany({
        where: { is_active: false, is_email_verified: true },
        select: {
          user_id: true,
          email: true,
          firstName: true,
          lastName: true,
          created_at: true,
        },
        orderBy: { created_at: 'asc' },
      })
    )
  })
)

router.post(
  '/approve/:user_id',
  ah(async (req, res) => {
    const id = parseId(req.params.user_id)
    if (!id) return res.status(400).json({ error: 'Identifiant invalide' })

    const user = await prisma.users.findUnique({ where: { user_id: id } })
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })
    if (!user.is_email_verified)
      return res.status(400).json({ error: 'Email non vérifié' })
    if (user.is_active)
      return res.status(400).json({ error: 'Compte déjà validé' })

    // Un nouvel utilisateur n'a que le rôle USER (créé au démarrage par ensureRoles)
    await prisma.users.update({
      where: { user_id: id },
      data: {
        is_active: true,
        userRoles: { create: { role: { connect: { role: ROLES.USER } } } },
      },
    })

    const token = await issueToken(id, TOKEN_TYPES.ACTIVATE, TTL.ACTIVATE_MS)
    await sendAccountSetupToUser(user, token).catch((e) =>
      console.error('Erreur envoi email setup :', e)
    )

    res.json({ message: `Compte de ${user.email} validé. Email envoyé.` })
  })
)

router.delete(
  '/reject/:user_id',
  ah(async (req, res) => {
    const id = parseId(req.params.user_id)
    if (!id) return res.status(400).json({ error: 'Identifiant invalide' })

    const user = await prisma.users.findUnique({ where: { user_id: id } })
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })
    if (user.is_active) {
      return res
        .status(400)
        .json({ error: 'Impossible de refuser un compte déjà validé' })
    }

    await prisma.users.delete({ where: { user_id: id } })
    await sendRejectedToUser(user).catch((e) =>
      console.error('Erreur envoi email rejet :', e)
    )

    res.json({ message: `Compte de ${user.email} refusé et supprimé.` })
  })
)

// ─── Utilisateurs, rôles & accès individuels ─────────────────────────────────
router.get(
  '/users',
  ah(async (_req, res) => {
    const users = await prisma.users.findMany({
      where: { is_active: true },
      select: {
        user_id: true,
        email: true,
        firstName: true,
        lastName: true,
        created_at: true,
        userRoles: { select: { role: { select: { role: true } } } },
        userModules: { select: { module_id: true } },
      },
      orderBy: { created_at: 'asc' },
    })
    res.json(
      await Promise.all(
        users.map(async ({ userRoles, userModules, ...u }) => {
          const admin = userRoles.some((r) => r.role.role === ROLES.ADMIN)
          return {
            ...u,
            isAdmin: admin,
            roles: userRoles.map((r) => r.role.role),
            modules: userModules.map((m) => m.module_id), // exceptions individuelles
            effective_modules: (await accessibleModules(u.user_id, admin)).map(
              (m) => m.module_id
            ),
          }
        })
      )
    )
  })
)

// Exceptions individuelles (en plus des rôles)
router.put(
  '/users/:user_id/modules',
  ah(async (req, res) => {
    const id = parseId(req.params.user_id)
    const list: unknown = req.body?.modules
    if (
      !id ||
      !Array.isArray(list) ||
      !list.every((m) => typeof m === 'string')
    ) {
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
  })
)

// Attribution des rôles (cumulables). On ne modifie pas ses propres rôles.
router.put(
  '/users/:user_id/roles',
  ah(async (req, res) => {
    const id = parseId(req.params.user_id)
    const list: unknown = req.body?.roles
    if (
      !id ||
      !Array.isArray(list) ||
      !list.every((r) => typeof r === 'string')
    ) {
      return res.status(400).json({ error: 'Champs invalides' })
    }
    if (id === req.user!.user_id) {
      return res
        .status(400)
        .json({ error: 'Vous ne pouvez pas modifier vos propres rôles' })
    }

    const user = await prisma.users.findUnique({ where: { user_id: id } })
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })

    const names = [...new Set(list as string[])]
    const found = await prisma.roles.findMany({
      where: { role: { in: names } },
    })
    if (found.length !== names.length)
      return res.status(400).json({ error: 'Rôle inconnu' })

    await prisma.$transaction([
      prisma.userRoles.deleteMany({ where: { user_id: id } }),
      prisma.userRoles.createMany({
        data: found.map((r) => ({ user_id: id, role_id: r.role_id })),
      }),
    ])
    res.json({ roles: found.map((r) => r.role) })
  })
)

// ─── Rôles : droits sur les modules et quota ─────────────────────────────────
async function roleView(role_id: number) {
  const role = await prisma.roles.findUniqueOrThrow({
    where: { role_id },
    include: { roleModules: true },
  })
  const known = (
    await prisma.modules.findMany({ select: { module_id: true } })
  ).map((m) => m.module_id)
  const listed = new Set(role.roleModules.map((m) => m.module_id))
  return {
    role_id,
    role: role.role,
    description: role.description,
    all_modules: role.all_modules,
    storage_quota_mb: role.storage_quota_mb,
    locked: role.role === ROLES.ADMIN,
    // modules effectivement accessibles parmi ceux enregistrés
    modules: known.filter((id) =>
      role.all_modules ? !listed.has(id) : listed.has(id)
    ),
  }
}

// `allowed` = modules accessibles voulus. Stocke l'inverse (exclusions) si all_modules.
// keepUnknown : conserve les entrées de modules pas encore enregistrés (ex: exclusion de "server")
async function writeRoleModules(
  role_id: number,
  all_modules: boolean,
  allowed: string[],
  keepUnknown: boolean
) {
  const known = (
    await prisma.modules.findMany({ select: { module_id: true } })
  ).map((m) => m.module_id)
  const existing = (
    await prisma.roleModules.findMany({ where: { role_id } })
  ).map((r) => r.module_id)
  const allowedSet = new Set(allowed)
  const rows = [
    ...(keepUnknown ? existing.filter((id) => !known.includes(id)) : []),
    ...known.filter((id) =>
      all_modules ? !allowedSet.has(id) : allowedSet.has(id)
    ),
  ]
  await prisma.$transaction([
    prisma.roleModules.deleteMany({ where: { role_id } }),
    prisma.roleModules.createMany({
      data: rows.map((module_id) => ({ role_id, module_id })),
    }),
  ])
}

router.get(
  '/roles',
  ah(async (_req, res) => {
    const roles = await prisma.roles.findMany({
      select: { role_id: true },
      orderBy: { role_id: 'asc' },
    })
    res.json(await Promise.all(roles.map((r) => roleView(r.role_id))))
  })
)

router.patch(
  '/roles/:role_id',
  ah(async (req, res) => {
    const id = parseId(req.params.role_id)
    if (!id) return res.status(400).json({ error: 'Identifiant invalide' })
    const role = await prisma.roles.findUnique({ where: { role_id: id } })
    if (!role) return res.status(404).json({ error: 'Rôle introuvable' })
    if (role.role === ROLES.ADMIN) {
      return res
        .status(403)
        .json({ error: "Le rôle ADMIN n'est pas modifiable" })
    }

    const body = req.body ?? {}
    const data: { all_modules?: boolean; storage_quota_mb?: number | null } = {}
    if ('storage_quota_mb' in body) {
      const q = body.storage_quota_mb
      if (q !== null && !(Number.isInteger(q) && q >= 0 && q <= 100_000_000)) {
        return res.status(400).json({ error: 'Quota invalide' })
      }
      data.storage_quota_mb = q
    }
    const toggled =
      typeof body.all_modules === 'boolean' &&
      body.all_modules !== role.all_modules
    if (toggled) data.all_modules = body.all_modules
    if (Object.keys(data).length === 0)
      return res.status(400).json({ error: 'Rien à modifier' })

    // Changer de mode inverse le sens de la liste : on réécrit pour garder les mêmes accès
    const before = toggled ? (await roleView(id)).modules : []
    await prisma.roles.update({ where: { role_id: id }, data })
    if (toggled) await writeRoleModules(id, body.all_modules, before, false)

    res.json(await roleView(id))
  })
)

router.put(
  '/roles/:role_id/modules',
  ah(async (req, res) => {
    const id = parseId(req.params.role_id)
    const list: unknown = req.body?.modules
    if (
      !id ||
      !Array.isArray(list) ||
      !list.every((m) => typeof m === 'string' && /^[a-z0-9-]{1,64}$/.test(m))
    ) {
      return res.status(400).json({ error: 'Champs invalides' })
    }
    const role = await prisma.roles.findUnique({ where: { role_id: id } })
    if (!role) return res.status(404).json({ error: 'Rôle introuvable' })
    if (role.role === ROLES.ADMIN) {
      return res
        .status(403)
        .json({ error: "Le rôle ADMIN n'est pas modifiable" })
    }

    await writeRoleModules(id, role.all_modules, list as string[], true)
    res.json(await roleView(id))
  })
)

// ─── Modules ─────────────────────────────────────────────────────────────────
router.get(
  '/modules',
  ah(async (_req, res) => {
    res.json(await prisma.modules.findMany({ orderBy: { name: 'asc' } }))
  })
)

router.patch(
  '/modules/:module_id',
  ah(async (req, res) => {
    const { is_enabled } = req.body ?? {}
    if (typeof is_enabled !== 'boolean')
      return res.status(400).json({ error: 'Rien à modifier' })

    const exists = await prisma.modules.findUnique({
      where: { module_id: req.params.module_id },
    })
    if (!exists) return res.status(404).json({ error: 'Module introuvable' })

    res.json(
      await prisma.modules.update({
        where: { module_id: req.params.module_id },
        data: { is_enabled },
      })
    )
  })
)

export default router
